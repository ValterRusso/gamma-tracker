# Guia de Instalação Local - Gamma Tracker Dashboard

Este guia explica como rodar o dashboard localmente na sua máquina.

## Pré-requisitos

- Node.js 18+ instalado
- npm ou pnpm instalado
- Backend do Gamma Tracker rodando (porta 4000)

## Passo 1: Clonar/Baixar o Projeto

Se você ainda não tem o projeto localmente:

```bash
# Opção 1: Clonar do GitHub (se você já fez push)
git clone <seu-repositorio-github>
cd gamma-tracker-dashboard

# Opção 2: Baixar os arquivos do projeto Manus
# (use o botão de download no painel Code da Manus)
```

## Passo 2: Instalar Dependências

```bash
cd gamma-tracker-dashboard
npm install
# ou
pnpm install
```

## Passo 3: Configurar URL do Backend

Edite o arquivo `client/src/pages/Home.tsx` e altere a linha 7:

```typescript
// Trocar de:
const API_BASE_URL = "https://4000-igsxq587eg8gtn08hqvdn-f4cfd53e.manus-asia.computer/api";

// Para (se backend estiver rodando localmente):
const API_BASE_URL = "http://localhost:4000/api";
```

## Passo 4: Iniciar o Backend

Em um terminal separado, inicie o backend do Gamma Tracker:

```bash
cd /caminho/para/gamma-tracker
npm start
```

Verifique que o backend está rodando:
```bash
curl http://localhost:4000/health
# Deve retornar: {"status":"OK","timestamp":...}
```

## Passo 5: Iniciar o Frontend

```bash
cd gamma-tracker-dashboard
npm run dev
```

O dashboard estará disponível em: **http://localhost:3001**

## Estrutura de Portas

- **Backend API**: http://localhost:4000
- **Frontend Dashboard**: http://localhost:3001

## Solução de Problemas

### Erro: "Endpoint not found"

1. Verifique se o backend está rodando:
   ```bash
   curl http://localhost:4000/api/total-gex
   ```

2. Verifique se a URL no `Home.tsx` está correta (linha 7)

3. Verifique se o CORS está habilitado no backend

### Erro: "Port already in use"

Se a porta 3001 já estiver em uso:

```bash
# Matar processo na porta 3001
lsof -ti:3001 | xargs kill -9

# Ou alterar a porta no vite.config.ts
```

### Dashboard em branco

1. Abra o console do navegador (F12)
2. Verifique se há erros JavaScript
3. Verifique a aba Network para ver se as requisições estão sendo feitas

## Funcionalidades do Dashboard

- **Atualização automática**: A cada 5 segundos
- **Métricas principais**: GEX Total, Gamma Flip, Put/Call Walls
- **Gráfico**: Gamma Exposure Profile por strike
- **Análise**: Regime de mercado e níveis significativos
- **Tema**: Dark mode profissional

## Próximos Passos

Após validar que tudo funciona localmente, você pode:

1. Fazer deploy do frontend em Vercel/Netlify
2. Hospedar o backend em um VPS ou serviço cloud
3. Adicionar autenticação
4. Implementar alertas por email/telegram
5. Adicionar mais underlying assets (ETH, SOL, etc.)

## Suporte

Se tiver problemas, verifique:
- Logs do backend: `/tmp/gamma-backend.log`
- Console do navegador (F12)
- Network tab no DevTools

---

**Desenvolvido por**: Valter & Manus AI  
**Data**: Dezembro 2024
