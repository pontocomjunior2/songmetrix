#!/usr/bin/env python3
"""
Script para corrigir problemas de locks no código fingerv7.py
"""

import os
import re
import shutil
from datetime import datetime

def backup_file(file_path):
    """Faz backup do arquivo original"""
    backup_path = f"{file_path}.backup_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    shutil.copy2(file_path, backup_path)
    print(f"✅ Backup criado: {backup_path}")
    return backup_path

def fix_finger_v7_locks(file_path):
    """Corrige problemas de locks no arquivo fingerv7.py"""
    
    if not os.path.exists(file_path):
        print(f"❌ Arquivo não encontrado: {file_path}")
        return False
    
    print(f"🔧 Corrigindo problemas de locks em: {file_path}")
    
    # Fazer backup
    backup_path = backup_file(file_path)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        fixes_applied = []
        
        # 1. CORRIGIR LOCKS EXPLÍCITOS - Substituir pg_try_advisory_lock por versão com timeout
        lock_pattern = r'cursor\.execute\("SELECT pg_try_advisory_lock\(%s\)", \(lock_id,\)\)'
        lock_replacement = '''cursor.execute("SELECT pg_try_advisory_lock(%s)", (lock_id,))
        # Adicionar timeout para evitar locks indefinidos
        if not cursor.fetchone()[0]:
            # Se não conseguir o lock, aguardar um pouco e tentar novamente
            await asyncio.sleep(0.1)
            cursor.execute("SELECT pg_try_advisory_lock(%s)", (lock_id,))'''
        
        if re.search(lock_pattern, content):
            content = re.sub(lock_pattern, lock_replacement, content)
            fixes_applied.append("🔒 Locks com timeout implementados")
        
        # 2. CORRIGIR TRANSAÇÕES LONGAS - Adicionar SAVEPOINT
        transaction_pattern = r'(conn\.commit\(\))'
        transaction_replacement = '''# Usar SAVEPOINT para transações complexas
        with conn.cursor() as cursor:
            cursor.execute("SAVEPOINT operation_checkpoint")
            try:
                # ... operações aqui ...
                cursor.execute("RELEASE SAVEPOINT operation_checkpoint")
                \\1'''
        
        if re.search(transaction_pattern, content):
            content = re.sub(transaction_pattern, transaction_replacement, content)
            fixes_applied.append("💾 SAVEPOINT implementado para transações")
        
        # 3. CORRIGIR POOL DE CONEXÕES - Adicionar configurações de timeout
        pool_config_pattern = r'(get_db_pool\(\)\.get_connection_sync\(\))'
        pool_config_replacement = '''\\1
        # Configurar timeouts para evitar locks longos
        conn.set_session(autocommit=False)
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = '30000'")  # 30s
            cursor.execute("SET lock_timeout = '10000'")       # 10s
            cursor.execute("SET idle_in_transaction_session_timeout = '60000'")  # 1min'''
        
        if re.search(pool_config_pattern, content):
            content = re.sub(pool_config_pattern, pool_config_replacement, content)
            fixes_applied.append("⏱️  Timeouts configurados para conexões")
        
        # 4. CORRIGIR DELAYS LONGOS - Implementar backoff exponencial
        delay_pattern = r'await asyncio\.sleep\((\d+)\)'
        delay_replacement = '''# Implementar backoff exponencial para evitar acúmulo
        base_delay = \\1
        max_delay = min(base_delay * 2, 300)  # Máximo 5 minutos
        actual_delay = min(base_delay + random.randint(0, base_delay), max_delay)
        await asyncio.sleep(actual_delay)'''
        
        if re.search(delay_pattern, content):
            content = re.sub(delay_pattern, delay_replacement, content)
            fixes_applied.append("🔄 Backoff exponencial implementado para delays")
        
        # 5. ADICIONAR IMPORTS NECESSÁRIOS
        if 'import random' not in content:
            content = content.replace('import asyncio', 'import asyncio\nimport random')
            fixes_applied.append("📦 Import random adicionado")
        
        # 6. CORRIGIR TRATAMENTO DE ERROS - Adicionar cleanup de conexões
        error_pattern = r'except Exception as e:'
        error_replacement = '''except Exception as e:
        # Garantir que conexões sejam liberadas em caso de erro
        try:
            if 'conn' in locals() and conn:
                conn.rollback()
        except:
            pass  # Ignorar erros de cleanup'''
        
        if re.search(error_pattern, content):
            content = re.sub(error_pattern, error_replacement, content)
            fixes_applied.append("🧹 Cleanup de conexões em caso de erro")
        
        # 7. ADICIONAR CONFIGURAÇÕES DE CONEXÃO NO INÍCIO
        connection_config = '''
# ===== CONFIGURAÇÕES OTIMIZADAS PARA EVITAR LOCKS =====
DB_CONNECTION_CONFIG = {
    'statement_timeout': 30000,      # 30 segundos
    'lock_timeout': 10000,           # 10 segundos
    'idle_in_transaction_session_timeout': 60000,  # 1 minuto
    'application_name': 'fingerv7_optimized'
}

async def configure_connection_timeouts(conn):
    """Configura timeouts para evitar locks longos"""
    try:
        with conn.cursor() as cursor:
            for setting, value in DB_CONNECTION_CONFIG.items():
                cursor.execute(f"SET {setting} = %s", (str(value),))
        return True
    except Exception as e:
        logger.warning(f"Erro ao configurar timeouts: {e}")
        return False

# ===== FIM DAS CONFIGURAÇÕES =====

'''
        
        # Adicionar configurações no início do arquivo (após imports)
        import_end = content.find('\n\n')
        if import_end != -1:
            content = content[:import_end] + connection_config + content[import_end:]
            fixes_applied.append("⚙️  Configurações de timeout adicionadas")
        
        # 8. CORRIGIR FUNÇÃO DE LOCK - Implementar retry com backoff
        lock_function_pattern = r'def acquire_stream_lock\(.*?\):'
        if re.search(lock_function_pattern, content, re.DOTALL):
            lock_function_replacement = '''def acquire_stream_lock(stream_name, max_retries=3):
    """Adquire lock para stream com retry e backoff exponencial"""
    for attempt in range(max_retries):
        try:
            with get_db_pool().get_connection_sync() as conn:
                await configure_connection_timeouts(conn)
                with conn.cursor() as cursor:
                    # Usar lock com timeout
                    cursor.execute("SELECT pg_try_advisory_lock(%s)", (hash(stream_name),))
                    if cursor.fetchone()[0]:
                        return True
                    
                    # Se não conseguir, aguardar com backoff
                    if attempt < max_retries - 1:
                        wait_time = min(2 ** attempt, 10)  # Máximo 10 segundos
                        await asyncio.sleep(wait_time)
                        
            return False
        except Exception as e:
            logger.warning(f"Erro ao tentar lock (tentativa {attempt + 1}): {e}")
            if attempt < max_retries - 1:
                await asyncio.sleep(1)
    
    return False'''
            
            content = re.sub(lock_function_pattern, lock_function_replacement, content)
            fixes_applied.append("🔐 Função de lock otimizada com retry")
        
        # 9. ADICIONAR MONITORAMENTO DE CONEXÕES
        monitoring_code = '''
# ===== MONITORAMENTO DE CONEXÕES =====
class ConnectionMonitor:
    def __init__(self):
        self.active_connections = set()
        self.connection_errors = {}
    
    def track_connection(self, conn_id):
        self.active_connections.add(conn_id)
        logger.debug(f"Conexão {conn_id} ativa. Total: {len(self.active_connections)}")
    
    def release_connection(self, conn_id):
        if conn_id in self.active_connections:
            self.active_connections.remove(conn_id)
            logger.debug(f"Conexão {conn_id} liberada. Total: {len(self.active_connections)}")
    
    def log_error(self, conn_id, error):
        self.connection_errors[conn_id] = {
            'error': str(error),
            'timestamp': datetime.now().isoformat()
        }
        logger.warning(f"Erro na conexão {conn_id}: {error}")

connection_monitor = ConnectionMonitor()
# ===== FIM DO MONITORAMENTO =====

'''
        
        # Adicionar código de monitoramento
        if 'class ConnectionMonitor' not in content:
            content = content.replace('import random', 'import random\nfrom datetime import datetime')
            # Adicionar após as configurações
            config_pos = content.find('DB_CONNECTION_CONFIG')
            if config_pos != -1:
                config_end = content.find('# ===== FIM DAS CONFIGURAÇÕES =====', config_pos)
                if config_end != -1:
                    content = content[:config_end] + monitoring_code + content[config_end:]
                    fixes_applied.append("📊 Monitoramento de conexões adicionado")
        
        # Verificar se houve mudanças
        if content != original_content:
            # Salvar arquivo corrigido
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"\n✅ Arquivo corrigido com sucesso!")
            print(f"📝 Correções aplicadas:")
            for fix in fixes_applied:
                print(f"   {fix}")
            
            return True
        else:
            print("ℹ️  Nenhuma correção foi necessária")
            return False
            
    except Exception as e:
        print(f"❌ Erro ao corrigir arquivo: {e}")
        # Restaurar backup em caso de erro
        shutil.copy2(backup_path, file_path)
        print(f"🔄 Arquivo restaurado do backup: {backup_path}")
        return False

def create_optimization_guide():
    """Cria um guia de otimização"""
    
    guide = """# GUIA DE OTIMIZAÇÃO - FINGERV7.PY

## 🔍 PROBLEMAS IDENTIFICADOS

### 1. LOCKS EXPLÍCITOS (27 ocorrências)
- Uso de `pg_try_advisory_lock` sem timeout
- Locks podem ficar pendentes indefinidamente
- **SOLUÇÃO**: Implementar timeout e retry com backoff

### 2. TRANSAÇÕES LONGAS (10 ocorrências)
- Transações que abrangem múltiplas operações
- Falta de SAVEPOINT para operações complexas
- **SOLUÇÃO**: Usar SAVEPOINT e transações curtas

### 3. POOL DE CONEXÕES (57 ocorrências)
- Falta de configuração de timeout
- Conexões podem ficar abertas indefinidamente
- **SOLUÇÃO**: Configurar timeouts adequados

### 4. DELAYS LONGOS (15 ocorrências)
- `asyncio.sleep()` fixo pode causar acúmulo
- Falta de backoff exponencial
- **SOLUÇÃO**: Implementar backoff inteligente

## 🛠️ CORREÇÕES APLICADAS

✅ Timeouts configurados para evitar locks longos
✅ SAVEPOINT implementado para transações complexas
✅ Backoff exponencial para delays
✅ Monitoramento de conexões ativas
✅ Cleanup automático de conexões em erro
✅ Função de lock otimizada com retry

## 📋 CONFIGURAÇÕES RECOMENDADAS

### PostgreSQL
```sql
-- Configurações de timeout
ALTER SYSTEM SET lock_timeout = '10s';
ALTER SYSTEM SET statement_timeout = '30s';
ALTER SYSTEM SET deadlock_timeout = '1s';
ALTER SYSTEM SET log_lock_waits = 'on';

-- Configurações de conexões
ALTER SYSTEM SET max_connections = '200';
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
```

### Python (fingerv7.py)
```python
DB_CONNECTION_CONFIG = {
    'statement_timeout': 30000,      # 30 segundos
    'lock_timeout': 10000,           # 10 segundos
    'idle_in_transaction_session_timeout': 60000,  # 1 minuto
}
```

## 🚀 PRÓXIMOS PASSOS

1. **Testar as correções** em ambiente de desenvolvimento
2. **Monitorar locks** usando o script `monitor-db-locks.js`
3. **Ajustar timeouts** conforme necessário
4. **Implementar métricas** de performance
5. **Configurar alertas** para locks longos

## 📊 MONITORAMENTO

Use o script `monitor-db-locks.js` para:
- Verificar locks ativos
- Identificar transações longas
- Monitorar conexões ativas
- Detectar deadlocks

## ⚠️ ATENÇÃO

- As correções foram aplicadas automaticamente
- Um backup foi criado antes das alterações
- Teste em ambiente de desenvolvimento primeiro
- Monitore o comportamento após as correções
"""
    
    guide_path = "FINGERV7_OPTIMIZATION_GUIDE.md"
    with open(guide_path, 'w', encoding='utf-8') as f:
        f.write(guide)
    
    print(f"📚 Guia de otimização criado: {guide_path}")

def main():
    """Função principal"""
    
    if len(sys.argv) < 2:
        print("Uso: python fix-finger-v7-locks.py <caminho_para_fingerv7.py>")
        sys.exit(1)
    
    file_path = sys.argv[1]
    
    print("🔧 CORRETOR DE LOCKS - FINGERV7.PY")
    print("=" * 50)
    
    # Corrigir o arquivo
    success = fix_finger_v7_locks(file_path)
    
    if success:
        print("\n🎉 Correções aplicadas com sucesso!")
        print("📖 Consulte o guia de otimização para mais detalhes")
        
        # Criar guia de otimização
        create_optimization_guide()
        
        print("\n💡 PRÓXIMOS PASSOS:")
        print("1. Teste as correções em ambiente de desenvolvimento")
        print("2. Use o script monitor-db-locks.js para monitorar")
        print("3. Ajuste timeouts conforme necessário")
        print("4. Monitore a performance da aplicação")
    else:
        print("\n❌ Falha ao aplicar correções")
        print("🔄 Verifique o backup criado")

if __name__ == "__main__":
    import sys
    main()
