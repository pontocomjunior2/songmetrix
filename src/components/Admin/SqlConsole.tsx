import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, Database, AlertTriangle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface QueryResult {
  success: boolean;
  rowCount: number;
  command: string;
  data?: any[];
  fields?: { name: string; dataTypeID: number }[];
  error?: string;
  details?: string;
  hint?: string;
}

const SqlConsole: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const { toast } = useToast();

  const executeQuery = async () => {
    if (!query.trim()) {
      toast({
        title: "Erro",
        description: "Digite uma query SQL para executar",
        variant: "destructive"
      });
      return;
    }

    setIsExecuting(true);
    setResult(null);

    try {
      const token = localStorage.getItem('supabase.auth.token');
      if (!token) {
        throw new Error('Token de autenticação não encontrado');
      }

      const response = await fetch('/api/admin/execute-sql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${JSON.parse(token).access_token}`
        },
        body: JSON.stringify({ sql: query })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao executar query');
      }

      setResult(data);
      
      // Adicionar ao histórico
      setHistory(prev => [query, ...prev.slice(0, 9)]); // Manter apenas 10 queries no histórico
      
      toast({
        title: "Sucesso",
        description: `Query executada com sucesso. ${data.rowCount} linha(s) afetada(s).`,
      });

    } catch (error: any) {
      const errorResult: QueryResult = {
        success: false,
        rowCount: 0,
        command: '',
        error: error.message,
        details: error.details
      };
      setResult(errorResult);
      
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsExecuting(false);
    }
  };

  const loadFromHistory = (historicalQuery: string) => {
    setQuery(historicalQuery);
  };

  const clearConsole = () => {
    setQuery('');
    setResult(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Console SQL Administrativo
          </CardTitle>
          <CardDescription>
            Execute queries SQL diretamente no banco de dados. Use com cuidado - apenas administradores têm acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="sql-query" className="text-sm font-medium">
              Query SQL
            </label>
            <Textarea
              id="sql-query"
              placeholder="Digite sua query SQL aqui...\n\nExemplo:\nSELECT * FROM users LIMIT 10;"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-[120px] font-mono text-sm"
              disabled={isExecuting}
            />
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={executeQuery} 
              disabled={isExecuting || !query.trim()}
              className="flex items-center gap-2"
            >
              {isExecuting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              {isExecuting ? 'Executando...' : 'Executar Query'}
            </Button>
            
            <Button 
              variant="outline" 
              onClick={clearConsole}
              disabled={isExecuting}
            >
              Limpar
            </Button>
          </div>

          {/* Avisos de segurança */}
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> Este console permite execução direta de SQL. 
              Queries perigosas (DROP, TRUNCATE, DELETE em tabelas críticas) são bloqueadas. 
              Para operações críticas, use o Supabase Dashboard.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Histórico de queries */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Histórico de Queries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((historicalQuery, index) => (
                <div 
                  key={index}
                  className="p-2 bg-muted rounded cursor-pointer hover:bg-muted/80 transition-colors"
                  onClick={() => loadFromHistory(historicalQuery)}
                >
                  <code className="text-sm">
                    {historicalQuery.length > 100 
                      ? `${historicalQuery.substring(0, 100)}...` 
                      : historicalQuery
                    }
                  </code>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resultado da query */}
      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-red-500" />
              )}
              Resultado da Query
            </CardTitle>
          </CardHeader>
          <CardContent>
            {result.success ? (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Badge variant="secondary">
                    Comando: {result.command}
                  </Badge>
                  <Badge variant="secondary">
                    Linhas: {result.rowCount}
                  </Badge>
                </div>

                {result.data && result.data.length > 0 ? (
                  <div className="overflow-auto">
                    <table className="w-full border-collapse border border-border">
                      <thead>
                        <tr className="bg-muted">
                          {result.fields?.map((field, index) => (
                            <th key={index} className="border border-border p-2 text-left font-medium">
                              {field.name}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {result.data.slice(0, 100).map((row, rowIndex) => (
                          <tr key={rowIndex} className="hover:bg-muted/50">
                            {result.fields?.map((field, colIndex) => (
                              <td key={colIndex} className="border border-border p-2 font-mono text-sm">
                                {row[field.name] !== null && row[field.name] !== undefined 
                                  ? String(row[field.name]) 
                                  : <span className="text-muted-foreground italic">null</span>
                                }
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {result.data.length > 100 && (
                      <p className="text-sm text-muted-foreground mt-2">
                        Mostrando apenas as primeiras 100 linhas de {result.data.length} resultados.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Query executada com sucesso, mas não retornou dados.</p>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p><strong>Erro:</strong> {result.error}</p>
                    {result.details && (
                      <p><strong>Detalhes:</strong> {result.details}</p>
                    )}
                    {result.hint && (
                      <p><strong>Dica:</strong> {result.hint}</p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default SqlConsole;