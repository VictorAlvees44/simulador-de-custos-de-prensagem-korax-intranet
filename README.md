# Simulador de Custo de Prensagem

![HTML5](https://img.shields.io/badge/HTML5-Frontend-orange)
![CSS3](https://img.shields.io/badge/CSS3-Responsive-blue)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-yellow)

## Sobre

Aplicação web desenvolvida para composição de conjuntos hidráulicos e geração de orçamentos técnicos.

O sistema permite selecionar componentes, calcular custos, agrupar itens em kits reutilizáveis e consolidar informações comerciais em uma única interface. Os dados utilizados durante o processo são carregados dinamicamente através de integrações externas, permitindo atualização de informações sem alterações no código da aplicação.

O projeto foi desenvolvido utilizando HTML, CSS e JavaScript puro, sem frameworks front-end.

---

## Principais Recursos

- Composição dinâmica de conjuntos técnicos
- Cálculo automático de custos
- Gerenciamento de kits reutilizáveis
- Consulta automática de CEP
- Controle de custos adicionais e descontos
- Atualização dinâmica da interface
- Tema claro e escuro
- Integração com fontes externas de dados
- Geração de propostas comerciais

---

## Arquitetura

A aplicação segue uma arquitetura client-side, executando integralmente no navegador.

A camada de apresentação foi desenvolvida em HTML5 e CSS3. A lógica de negócio, validações, cálculos e integrações são executadas em JavaScript ES6+.

Os dados são consumidos através de endpoints externos utilizando requisições assíncronas via Fetch API.

```text
┌─────────────────┐
│    Front-End    │
│ HTML • CSS • JS │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Google Apps    │
│     Script      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Google Sheets   │
│ Fonte de Dados  │
└─────────────────┘
```

---

## Tecnologias Utilizadas

### Front-End

- HTML5
- CSS3
- JavaScript ES6+

### Bibliotecas

- Tom Select

### Integrações

- Google Apps Script
- Google Sheets
- ViaCEP

---

## Estrutura do Projeto

```text
/
├── index.html
├── style.css
├── script.js
├── img/
│   ├── logo.png
│   └── logo2.png
└── README.md
```

### index.html

Responsável pela estrutura da aplicação, formulários, componentes e organização da interface.

### style.css

Contém estilização, responsividade, sistema de temas e comportamento visual dos componentes.

### script.js

Concentra regras de negócio, cálculos, validações, gerenciamento de estado e integrações externas.

---

## Fluxo de Funcionamento

1. O usuário seleciona os componentes desejados.
2. Os dados são carregados dinamicamente da fonte externa.
3. Os valores são processados em tempo real.
4. Os itens podem ser agrupados em kits reutilizáveis.
5. Custos adicionais e descontos são aplicados.
6. O orçamento é consolidado automaticamente.
7. Os dados ficam disponíveis para geração da proposta.

---

## Instalação

Clone o repositório:

```bash
git clone https://github.com/seu-usuario/seu-repositorio.git
```

Acesse a pasta:

```bash
cd seu-repositorio
```

Abra o arquivo `index.html` diretamente no navegador ou publique a aplicação em um servidor web.

---

## Deploy

O projeto pode ser publicado utilizando:

- GitHub Pages
- Google Apps Script Web App
- Servidores Apache ou Nginx
- Hospedagens estáticas

---

## Características Técnicas

- Carregamento assíncrono de dados
- Manipulação dinâmica do DOM
- Componentes reutilizáveis
- Persistência local de configurações
- Interface responsiva
- Estrutura modular baseada em funções
- Compatibilidade com navegadores modernos

---

## Roadmap

Funcionalidades previstas para futuras versões:

- Sistema de autenticação
- Controle de permissões
- Histórico de orçamentos
- Dashboard analítico
- API dedicada
- Integração com ERP
- Integração com CRM
- Exportações avançadas

---

## Licença

Este projeto é disponibilizado para fins de desenvolvimento, estudo e evolução contínua da plataforma.
