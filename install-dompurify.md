# Instalação da Dependência DOMPurify

Para que o componente InsightDashboardPage funcione corretamente, é necessário instalar a biblioteca DOMPurify para sanitização segura de HTML.

## Comando de Instalação

```bash
npm install dompurify
npm install --save-dev @types/dompurify
```

## Alternativa usando yarn

```bash
yarn add dompurify
yarn add -D @types/dompurify
```

## Por que DOMPurify?

A biblioteca DOMPurify é usada para sanitizar o HTML dos insights antes de renderizá-los no modal de revisão, garantindo segurança contra ataques XSS.

## Uso no Componente

```typescript
import DOMPurify from 'dompurify';

// No componente
<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(selectedDraft.content)
  }}
  className="prose prose-sm max-w-none"
/>
```

## Alternativa Sem DOMPurify

Se preferir não instalar a biblioteca, você pode substituir a renderização HTML por texto simples:

```typescript
// Substituir esta linha:
<div
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(selectedDraft.content)
  }}
  className="prose prose-sm max-w-none"
/>

// Por esta:
<pre className="whitespace-pre-wrap text-sm bg-muted p-4 rounded border overflow-auto max-h-96">
  {selectedDraft.content}
</pre>
```