# Mini Spot-Gamma Tracker

Sistema de análise de Gamma Exposure (GEX) para options de criptomoedas na Binance.

## 📋 Sobre o Projeto

Este projeto implementa um tracker pessoal de spot-gamma para monitorar a exposição gamma do mercado de options de crypto (BTC, ETH) em tempo real, utilizando dados da Binance.

### Funcionalidades Planejadas

- ✅ Coleta de dados via REST API e WebSocket
- 🔄 Cálculo de Gamma Exposure (GEX) por strike
- 🔄 Identificação de Gamma Flip
- 🔄 Detecção de Put/Call Walls
- 🔄 Dashboard interativo com React
- 🔄 Alertas e interpretações inteligentes
- 🔄 Análise de regimes de mercado

## 🏗️ Arquitetura

### Backend (Node.js)
- **Coleta de Dados**: WebSocket streams da Binance
- **Processamento**: Cálculo de GEX e métricas
- **API**: Express.js para servir dados ao frontend
- **Banco de Dados**: MySQL com Sequelize ORM

### Frontend (React + Vite)
- **Dashboard**: Visualização interativa de dados
- **Gráficos**: Chart.js / Recharts
- **UI**: TailwindCSS

## 📦 Instalação

```bash
# Clonar o repositório
cd gamma-tracker

# Instalar dependências
npm install

# Configurar variáveis de ambiente
cp .env.example .env
# Editar .env conforme necessário
```

## 🧪 Testes

### Teste de Conectividade REST API

```bash
node test-rest-api.js
```

Este script testa:
- Conectividade com a API da Binance
- Obtenção de informações dos contratos
- Coleta de mark price e gregas
- Coleta de open interest

### Teste de WebSocket

```bash
node test-websocket-v2.js
```

Este script:
- Conecta ao stream de mark price em tempo real
- Exibe dados de gregas atualizados a cada segundo
- Mostra a estrutura dos dados recebidos

## 📊 Dados da Binance Options API

### Endpoints REST Utilizados

- `GET /eapi/v1/ping` - Teste de conectividade
- `GET /eapi/v1/exchangeInfo` - Informações dos contratos
- `GET /eapi/v1/mark` - Mark price e gregas
- `GET /eapi/v1/openInterest` - Open interest

### WebSocket Streams

- `<underlying>@markPrice` - Mark price e gregas (update: 1s)
- `<underlying>@openInterest@<date>` - Open interest (update: 60s)

### Gregas Fornecidas

A Binance fornece as seguintes gregas calculadas:
- **Delta**: Sensibilidade ao preço do ativo subjacente
- **Gamma**: Taxa de mudança do delta
- **Theta**: Decaimento temporal
- **Vega**: Sensibilidade à volatilidade implícita

## 🗺️ Roadmap

### Fase 1: Setup e Coleta de Dados ✅ (Concluída)
- [x] Estrutura do projeto
- [x] Conexão com REST API
- [x] Conexão com WebSocket
- [x] Validação de dados

### Fase 2: Cálculo de GEX e API (Em Progresso)
- [ ] Implementar cálculo de GEX
- [ ] Criar API REST para expor dados
- [ ] Persistência no MySQL
- [ ] Identificação de Gamma Flip e Walls

### Fase 3: Dashboard Básico
- [ ] Setup do projeto React
- [ ] Gráfico de perfil de gamma
- [ ] Indicadores principais
- [ ] Consumo da API backend

### Fase 4: Funcionalidades Avançadas
- [ ] Sistema de alertas
- [ ] Análise de regimes
- [ ] Interpretações automatizadas
- [ ] Refinamento UI/UX

## 📝 Notas Importantes

### Sobre as Gregas da Binance

**Observação Importante**: O WebSocket stream `@markPrice` retorna apenas o **mark price** por option, mas **NÃO inclui as gregas** no payload. As gregas (Delta, Gamma, Theta, Vega) estão disponíveis apenas via:

1. **REST API** `GET /eapi/v1/mark` - Retorna gregas completas
2. **User Data Stream** (ACCOUNT_UPDATE) - Atualiza gregas da conta a cada 50ms

**Implicação para o Projeto**: 

Para obter gregas em tempo real, temos duas opções:

**Opção A (Recomendada para MVP)**: 
- Fazer polling do endpoint REST `/eapi/v1/mark` a cada 1-5 segundos
- Mais simples de implementar
- Suficiente para a maioria dos casos de uso

**Opção B (Para versão avançada)**:
- Implementar cálculo próprio das gregas usando Black-76
- Usar biblioteca `@haydenr4/blackscholes_wasm`
- Maior controle e flexibilidade
- Permite validação cruzada com dados da Binance

### Limitações Conhecidas

- Open Interest via REST API retorna erro em alguns casos (investigar formato correto)
- WebSocket de OI requer data de expiração específica
- Contract Size para crypto options da Binance = 1

## 🔧 Tecnologias

- **Node.js** - Runtime JavaScript
- **Express.js** - Framework web
- **WebSocket (ws)** - Cliente WebSocket
- **Axios** - Cliente HTTP
- **MySQL** - Banco de dados
- **Sequelize** - ORM
- **React** - Framework frontend
- **Vite** - Build tool
- **Chart.js** - Visualização de dados

## 📄 Licença

MIT

## 👤 Autor

Desenvolvido por Valter com assistência da Manus AI
