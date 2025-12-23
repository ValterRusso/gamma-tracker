# Proposta de Arquitetura e Roadmap: Mini Spot-Gamma Tracker

**Data**: 21 de Dezembro de 2025
**Autor**: Manus AI

## 1. Resumo do Projeto

Este documento detalha a proposta de arquitetura técnica e o roadmap de desenvolvimento para a criação de um **mini spot-gamma tracker pessoal**. O sistema será desenvolvido em **Node.js** (backend) e **React** (frontend), utilizando dados de options de criptomoedas (inicialmente focado em BTC e ETH) provenientes da **Binance**.

O objetivo é fornecer uma ferramenta de análise em tempo real para monitorar a exposição gamma do mercado, identificar níveis críticos e auxiliar na tomada de decisões de trading. As principais funcionalidades incluem o cálculo de **Gamma Exposure (GEX)**, a identificação de **Gamma Flip**, **Put/Call Walls** e a visualização de um dashboard interativo.

## 2. Arquitetura Técnica Proposta

A arquitetura será dividida em três componentes principais: Backend, Frontend e Banco de Dados.

![Arquitetura do Sistema](https://i.imgur.com/example.png)  <!-- Placeholder for a diagram -->

### 2.1. Backend (Node.js)

O backend será o coração do sistema, responsável pela coleta, processamento e disponibilização dos dados.

- **Coleta de Dados**: Utilizará o conector oficial da Binance para Node.js (`@binance/connector`) para se conectar aos streams WebSocket.
  - **Streams Essenciais**: `@markPrice` para obter gregas e mark price em tempo real (update de 1s) e `@openInterest@<expirationDate>` para o open interest (update de 60s).
  - **Endpoints REST**: `GET /eapi/v1/exchangeInfo` para obter a lista de todos os contratos de options ativos e `GET /eapi/v1/openInterest` para uma carga inicial do open interest.

- **Processamento e Cálculo**:
  - **Cálculo de GEX**: Para cada contrato de option, o GEX será calculado usando a fórmula:
    > GEX = Gamma × Multiplicador_Contrato × Open_Interest × Preco_Spot² × 0.01
    - O sinal será determinado pela natureza da option (positivo para Calls, negativo para Puts), assumindo o posicionamento padrão dos market makers.
  - **Agregação**: Os valores de GEX serão agregados por strike para montar o perfil de gamma.
  - **Identificação de Níveis**: Algoritmos serão implementados para identificar o **Gamma Flip** (nível onde o GEX total cruza o zero), **Put Wall** (strike com maior GEX de Puts) e **Call Wall** (strike com maior GEX de Calls).

- **API Server**: Um servidor API (usando **Express.js** ou **Fastify**) irá expor os dados processados para o frontend através de endpoints REST e, potencialmente, um WebSocket para atualizações em tempo real no dashboard.

### 2.2. Frontend (React + Vite)

O frontend será a interface do usuário, construída como uma Single Page Application (SPA).

- **Estrutura**: Projeto iniciado com **Vite** para um ambiente de desenvolvimento rápido e eficiente.
- **Visualização de Dados**: Utilizará uma biblioteca de gráficos como **Chart.js**, **Recharts** ou **D3.js** para renderizar:
  - O gráfico de perfil de gamma (Gamma Profile).
  - Indicadores chave (GEX total, Gamma Flip, Walls).
  - Gráficos de evolução temporal do GEX.
- **Interatividade**: Permitirá ao usuário selecionar o ativo subjacente (BTC, ETH), filtrar por datas de expiração e interagir com os gráficos.

### 2.3. Banco de Dados (MySQL + Sequelize)

O banco de dados será usado para persistir dados históricos e configurações.

- **ORM**: **Sequelize** será utilizado para abstrair as interações com o banco de dados MySQL, facilitando a modelagem e as queries.
- **Schema**: As tabelas principais incluirão:
  - `gex_history`: Armazenará snapshots do GEX total e níveis chave em intervalos regulares (ex: a cada 5 minutos).
  - `contracts`: Manterá um registro dos contratos de options para referência.
  - `settings`: Guardará configurações do usuário e do sistema.

## 3. Fontes de Dados e Confiabilidade

- **Gregas da Binance**: A decisão inicial é **confiar nas gregas (Delta, Gamma, Vega, Theta) fornecidas pela Binance** via API. Elas são atualizadas a cada segundo no stream `@markPrice`, o que é suficiente para a maioria dos casos de uso e elimina a complexidade de calcular tudo do zero.
- **Validação Cruzada**: Como uma etapa de validação e para garantir a precisão, podemos implementar um cálculo próprio usando o modelo **Black-76** (adequado para options de futuros) e a biblioteca `@haydenr4/blackscholes_wasm`. Isso permitirá comparar os resultados com os da Binance e ajustar se necessário.

## 4. Roadmap de Desenvolvimento

Propomos um roadmap incremental, dividido em 4 fases principais, para garantir entregas de valor contínuas e permitir ajustes ao longo do caminho.

| Fase | Título | Duração Estimada | Entregáveis Principais |
| :--: | --- | --- | --- |
| **1** | **Setup e Coleta de Dados** | 1 semana | - Backend Node.js configurado.<br>- Conexão com WebSocket da Binance.<br>- Script para coletar e exibir dados de gregas e OI. |
| **2** | **Cálculo de GEX e API** | 2 semanas | - Implementação da lógica de cálculo de GEX.<br>- API REST para expor o perfil de gamma e GEX total.<br>- Persistência inicial dos dados no MySQL. |
| **3** | **Dashboard Básico** | 2 semanas | - Frontend React com estrutura básica.<br>- Gráfico de perfil de gamma consumindo a API.<br>- Exibição dos níveis de Gamma Flip e Walls. |
| **4**| **Funcionalidades Avançadas** | Contínuo | - Alertas de sistema.<br>- Análise de regimes de mercado.<br>- Interpretações e insights automatizados.<br>- Refinamento da UI/UX. |

## 5. Tecnologias Sugeridas

| Categoria | Tecnologia | Justificativa |
| --- | --- | --- |
| **Backend** | Node.js, Express.js | Ecossistema maduro, alta performance para I/O, ideal para WebSockets. |
| **Frontend** | React, Vite, TailwindCSS | Desenvolvimento rápido, componentização, UI moderna e responsiva. |
| **Banco de Dados** | MySQL, Sequelize | Solução relacional robusta e popular, com um ORM que facilita o desenvolvimento. |
| **Gráficos** | Chart.js / Recharts | Bibliotecas populares e fáceis de usar para visualização de dados em React. |
| **Conector API** | `@binance/connector` | Biblioteca oficial da Binance para interagir com a API. |

---

*Este é um plano inicial e pode ser refinado com base em suas prioridades e feedback.*
