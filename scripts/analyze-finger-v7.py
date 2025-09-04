#!/usr/bin/env python3
"""
Script para analisar o código fingerv7.py e identificar problemas de locks de banco de dados
"""

import os
import re
import sys
from pathlib import Path

def analyze_python_file(file_path):
    """Analisa um arquivo Python em busca de padrões que podem causar locks"""
    
    if not os.path.exists(file_path):
        print(f"❌ Arquivo não encontrado: {file_path}")
        return
    
    print(f"🔍 Analisando: {file_path}")
    print("=" * 80)
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
            lines = content.split('\n')
    except Exception as e:
        print(f"❌ Erro ao ler arquivo: {e}")
        return
    
    # Padrões para identificar problemas
    patterns = {
        'transactions': {
            'pattern': r'(BEGIN|START TRANSACTION|COMMIT|ROLLBACK)',
            'description': 'Transações explícitas'
        },
        'locks': {
            'pattern': r'(LOCK|FOR UPDATE|FOR SHARE|NOWAIT|SKIP LOCKED)',
            'description': 'Locks explícitos'
        },
        'long_queries': {
            'pattern': r'(SELECT.*FROM.*WHERE.*AND.*AND.*AND|INSERT.*SELECT|UPDATE.*WHERE.*AND)',
            'description': 'Queries complexas que podem ser lentas'
        },
        'connection_pool': {
            'pattern': r'(psycopg2|asyncpg|sqlalchemy|create_engine|connection|cursor)',
            'description': 'Gerenciamento de conexões'
        },
        'batch_operations': {
            'pattern': r'(executemany|batch_insert|bulk_insert|COPY)',
            'description': 'Operações em lote'
        },
        'sleep_delays': {
            'pattern': r'(time\.sleep|asyncio\.sleep|await asyncio\.sleep)',
            'description': 'Delays que podem causar acúmulo de conexões'
        },
        'error_handling': {
            'pattern': r'(try:|except|finally:)',
            'description': 'Tratamento de erros'
        },
        'database_queries': {
            'pattern': r'(execute|query|fetch|fetchall|fetchone)',
            'description': 'Execução de queries'
        }
    }
    
    issues = []
    
    for line_num, line in enumerate(lines, 1):
        line = line.strip()
        if not line or line.startswith('#'):
            continue
            
        for issue_type, config in patterns.items():
            matches = re.findall(config['pattern'], line, re.IGNORECASE)
            if matches:
                issues.append({
                    'line': line_num,
                    'type': issue_type,
                    'description': config['description'],
                    'content': line[:100] + '...' if len(line) > 100 else line,
                    'matches': matches
                })
    
    # Agrupar por tipo de problema
    grouped_issues = {}
    for issue in issues:
        if issue['type'] not in grouped_issues:
            grouped_issues[issue['type']] = []
        grouped_issues[issue['type']].append(issue)
    
    # Mostrar resultados
    if not issues:
        print("✅ Nenhum problema potencial encontrado!")
        return
    
    print(f"⚠️  Encontrados {len(issues)} problemas potenciais:\n")
    
    for issue_type, type_issues in grouped_issues.items():
        print(f"📋 {type_issues[0]['description'].upper()} ({len(type_issues)} ocorrências):")
        for issue in type_issues:
            print(f"   Linha {issue['line']}: {issue['content']}")
        print()
    
    # Recomendações específicas
    print("💡 RECOMENDAÇÕES PARA EVITAR LOCKS:")
    print("-" * 50)
    
    if 'transactions' in grouped_issues:
        print("🔒 TRANSAÇÕES:")
        print("   • Mantenha transações o mais curtas possível")
        print("   • Evite transações que abrangem múltiplas operações")
        print("   • Use SAVEPOINT para operações complexas")
        print("   • Sempre faça COMMIT ou ROLLBACK")
        print()
    
    if 'locks' in grouped_issues:
        print("🔐 LOCKS EXPLÍCITOS:")
        print("   • Evite locks desnecessários")
        print("   • Use NOWAIT para evitar esperas indefinidas")
        print("   • Considere usar SELECT FOR UPDATE SKIP LOCKED")
        print()
    
    if 'connection_pool' in grouped_issues:
        print("🔌 POOL DE CONEXÕES:")
        print("   • Configure tamanho adequado do pool")
        print("   • Implemente retry com backoff exponencial")
        print("   • Monitore conexões ativas")
        print("   • Use connection pooling adequado")
        print()
    
    if 'batch_operations' in grouped_issues:
        print("📦 OPERAÇÕES EM LOTE:")
        print("   • Use executemany para múltiplas inserções")
        print("   • Considere usar COPY para grandes volumes")
        print("   • Implemente chunking para evitar transações muito longas")
        print()
    
    if 'sleep_delays' in grouped_issues:
        print("⏰ DELAYS:")
        print("   • Evite delays longos entre operações")
        print("   • Use rate limiting inteligente")
        print("   • Implemente backoff exponencial")
        print()
    
    print("🔧 CONFIGURAÇÕES RECOMENDADAS:")
    print("-" * 50)
    print("• max_connections: 100-200 (dependendo do servidor)")
    print("• statement_timeout: 30s")
    print("• lock_timeout: 10s")
    print("• deadlock_timeout: 1s")
    print("• log_lock_waits: on")
    print("• log_statement: 'all' (para debug)")
    print()
    
    print("📊 MONITORAMENTO:")
    print("-" * 50)
    print("• Use o script monitor-db-locks.js para monitorar locks")
    print("• Configure alertas para locks longos")
    print("• Monitore o tempo de resposta das queries")
    print("• Verifique estatísticas de tabelas regularmente")

def analyze_directory(directory_path):
    """Analisa todos os arquivos Python em um diretório"""
    
    if not os.path.exists(directory_path):
        print(f"❌ Diretório não encontrado: {directory_path}")
        return
    
    print(f"🔍 Analisando diretório: {directory_path}")
    print("=" * 80)
    
    python_files = []
    for root, dirs, files in os.walk(directory_path):
        for file in files:
            if file.endswith('.py'):
                python_files.append(os.path.join(root, file))
    
    if not python_files:
        print("❌ Nenhum arquivo Python encontrado")
        return
    
    print(f"📁 Encontrados {len(python_files)} arquivos Python:")
    for file in python_files:
        print(f"   • {file}")
    print()
    
    for file in python_files:
        analyze_python_file(file)
        print("\n" + "=" * 80 + "\n")

def main():
    """Função principal"""
    
    if len(sys.argv) < 2:
        print("Uso: python analyze-finger-v7.py <caminho_para_fingerv7.py>")
        print("   ou: python analyze-finger-v7.py <diretório> --dir")
        sys.exit(1)
    
    target_path = sys.argv[1]
    is_directory = len(sys.argv) > 2 and sys.argv[2] == '--dir'
    
    if is_directory:
        analyze_directory(target_path)
    else:
        analyze_python_file(target_path)

if __name__ == "__main__":
    main()
