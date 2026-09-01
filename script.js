/* Estado */
const state = {
    faturamento: null,
    selecoes: {},
    catalogo: 'loading'
};

function atualizarState(id, value) {
    state.selecoes[id] = value;
}

/* Config */
const CONFIG = {
    apiUrl: 'https://script.google.com/a/macros/koraxbrasil.com.br/s/AKfycbwovQZWphuoXAYWfn71aKevgMBWUyVoZZ4AG2i7tk45ZqQ-7DU6mlB4wRKPW4lf6j_tIA/exec?acao=carregar'
};

/* Dados */
let dados = {
    mangueiras: [],
    terminais: []
};

/* Tom Select */
const tomSelects = {};

/* UI */
const UI = {
    get: (id) => document.getElementById(id),
    setHTML: (id, value) => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = value;
    },
    setValue: (id, value) => {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }
};

const AVISO_LEGAL_TEXTO = {
    titulo: 'OBSERVAÇÕES',
    p1: 'Este documento possui caráter exclusivamente informativo e destina-se à apresentação preliminar de itens, composições e valores estimados.',
    p2: 'Não constitui documento fiscal, proposta comercial formal, contrato, pedido de compra ou garantia de fornecimento, estando sujeito à validação e confirmação das informações apresentadas.',
    pdfRodape: 'Documento emitido exclusivamente para fins informativos. Não possui validade fiscal, contratual ou jurídica.'
};

let avisoLegalConfirmado = false;

function blocoObservacoesResultado() {
    return `
        <div class="resultado-observacoes">
            <strong>${AVISO_LEGAL_TEXTO.titulo}</strong>
            <p>${AVISO_LEGAL_TEXTO.p1}</p>
            <p>${AVISO_LEGAL_TEXTO.p2}</p>
        </div>
    `;
}

/* Tema */
(function initTema() {
    const body = document.body;
    const btn = document.getElementById('themeButton');
    const logo = document.getElementById('logoKorax');
    if (!btn) return;

    function atualizarLogoTema() {
        if (!logo) return;
        logo.src = body.classList.contains('dark-mode') ? 'img/logo2.png' : 'img/logo.png';
    }

    if (localStorage.getItem('tema') === 'dark') {
        body.classList.add('dark-mode');
        btn.innerHTML = '☀️';
    }
    atualizarLogoTema();

    btn.addEventListener('click', () => {
        body.classList.toggle('dark-mode');
        const dark = body.classList.contains('dark-mode');
        btn.innerHTML = dark ? '☀️' : '🌙';
        localStorage.setItem('tema', dark ? 'dark' : 'light');
        atualizarLogoTema();
    });
})();

/* Planilha */
function normalizarTexto(value) {
    return String(value || '')
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function normalizarLinhaPlanilha(item) {
    const linha = {};
    Object.keys(item || {}).forEach(key => {
        linha[normalizarTexto(key)] = item[key];
    });

    function valorColuna(...tokens) {
        const chave = Object.keys(linha).find(key =>
            tokens.every(token => key.includes(token))
        );
        return chave ? linha[chave] : '';
    }

    const codigo   = linha.codigo || linha.cod || linha.item || linha.referencia || linha.ref || '';
    const descricao = linha.descricao || linha.descricao_do_item || linha.nome || linha.produto || '';

    return {
        ...linha,
        codigo:   String(codigo   || '').trim(),
        descricao: String(descricao || '').trim(),
        sp18: linha.sp18 || valorColuna('sao', '18') || valorColuna('sp', '18'),
        sc12: linha.sc12 || valorColuna('santa', '12') || valorColuna('sc', '12'),
        sp4:  linha.sp4  || valorColuna('sao', '4')  || valorColuna('sp', '4'),
        sc4:  linha.sc4  || valorColuna('santa', '4') || valorColuna('sc', '4')
    };
}

/* Controles */
function getTerminalIds() {
    const extras = Array.from(
        document.querySelectorAll('.terminal-extra-linha select[id^="terminalExtra"]')
    ).map(el => el.id);
    return ['terminalA', 'terminalB', ...extras];
}

function getMangueiraIds() {
    return Array.from(
        document.querySelectorAll('.mangueira-linha select[id^="mangueira"]')
    ).map(el => el.id);
}

function sincronizarEstadoControles() {
    const temFaturamento = Boolean(UI.get('faturamento')?.value);
    const catalogoDisponivel = state.catalogo === 'ready';
    const podeUsar = temFaturamento && catalogoDisponivel;

    const terminalIds = getTerminalIds();
    terminalIds.forEach(id => {
        if (tomSelects[id]) {
            podeUsar ? tomSelects[id].enable() : tomSelects[id].disable();
        } else {
            const campo = UI.get(id);
            if (campo) campo.disabled = !podeUsar;
        }
    });

    const btnAdd = UI.get('btnAddMangueira');
    if (btnAdd) btnAdd.disabled = !podeUsar;

    const btnAddT = UI.get('btnAddTerminal');
    if (btnAddT) btnAddT.disabled = !podeUsar;

    const btnCalc = UI.get('btnCalcular');
    if (btnCalc) btnCalc.disabled = !podeUsar;

    const btnSalvarKit = UI.get('btnSalvarKit');
    if (btnSalvarKit) btnSalvarKit.disabled = !catalogoDisponivel;
}

function atualizarStatusCatalogo(tipo, mensagem) {
    state.catalogo = tipo;
    const status = UI.get('statusCatalogo');
    if (status) {
        status.className = `catalogo-status catalogo-status--${tipo}`;
        status.textContent = mensagem;
    }
    sincronizarEstadoControles();
}

/* Selects */
function carregarSelect(id, lista, isMangueira) {
    const select = document.getElementById(id);
    if (!select) return;

    select.innerHTML = isMangueira
        ? `<option value="">Selecione a mangueira</option>`
        : `<option value="na">Nenhum</option>`;

    select.innerHTML += lista.map(item => {
        const codigo = escaparHTML(item.codigo);
        const descricao = item.descricao ? ' – ' + escaparHTML(item.descricao) : '';
        return `<option value="${codigo}">${codigo}${descricao}</option>`;
    }).join('');

    select.onchange = () => {
        mostrarDescricaoSelect(id, isMangueira);
        autoCalcular();
    };

    if (tomSelects[id]) tomSelects[id].destroy();
    if (typeof TomSelect === 'undefined') return;

    tomSelects[id] = new TomSelect(select, {
        create: false,
        maxOptions: 999999,
        searchField: ['text'],
        placeholder: isMangueira ? 'Digite para buscar a mangueira...' : 'Digite para buscar o terminal...',
        allowEmptyOption: true,
        openOnFocus: true,
        closeAfterSelect: true,
        selectOnTab: true,
        render: {
            no_results: (data, escape) =>
                `<div class="select-empty">Nenhum resultado para "${escape(data.input)}"</div>`,
            option: (data, escape) =>
                `<div class="select-option"><strong>${escape(data.text)}</strong></div>`,
            item: (data, escape) =>
                `<div class="select-item">${escape(data.text)}</div>`
        }
    });

    const podeUsar = Boolean(UI.get('faturamento')?.value) && state.catalogo === 'ready';
    if (!podeUsar && tomSelects[id]) {
        tomSelects[id].disable();
    }
}

function setSelectValue(id, value) {
    if (tomSelects[id]) {
        tomSelects[id].setValue(value || '', true);
    } else {
        const select = document.getElementById(id);
        if (select) select.value = value || '';
    }
}

async function carregarDados() {
    atualizarStatusCatalogo('loading', 'Carregando catálogo de produtos…');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
        const resposta = await fetch(CONFIG.apiUrl, {
            signal: controller.signal,
            headers: { Accept: 'application/json' }
        });
        if (!resposta.ok) throw new Error(`Falha ao carregar catálogo (HTTP ${resposta.status}).`);
        const resultado = await resposta.json();
        if (!Array.isArray(resultado?.mangueiras) || !Array.isArray(resultado?.terminais)) {
            throw new Error('O catálogo retornou um formato inválido.');
        }

        dados.mangueiras = resultado.mangueiras.map(normalizarLinhaPlanilha).filter(item => item.codigo);
        dados.terminais = resultado.terminais.map(normalizarLinhaPlanilha).filter(item => item.codigo);
        if (dados.mangueiras.length === 0 || dados.terminais.length === 0) {
            throw new Error('O catálogo está vazio ou incompleto.');
        }

        getTerminalIds().forEach(id => {
            carregarSelect(id, dados.terminais, false);
        });

        getMangueiraIds().forEach(id => {
            carregarSelect(id, dados.mangueiras, true);
        });

        atualizarStatusCatalogo('ready', `Catálogo carregado: ${dados.mangueiras.length} mangueiras e ${dados.terminais.length} terminais.`);
    } catch (erro) {
        dados.mangueiras = [];
        dados.terminais = [];
        const mensagem = erro?.name === 'AbortError'
            ? 'O catálogo demorou demais para responder. Recarregue a página para tentar novamente.'
            : `${erro?.message || 'Não foi possível carregar o catálogo.'} Recarregue a página para tentar novamente.`;
        atualizarStatusCatalogo('error', mensagem);
    } finally {
        clearTimeout(timeoutId);
    }
}

/* Mangueiras */
let contadorMangueira = 0;

function adicionarLinhaMangueira() {
    if (state.catalogo !== 'ready') {
        alert('Aguarde o carregamento do catálogo de produtos.');
        return;
    }
    const temFaturamento = Boolean(UI.get('faturamento')?.value);
    if (!temFaturamento) {
        alert('Selecione o faturamento primeiro.');
        return;
    }

    contadorMangueira++;
    const id = `mangueira${contadorMangueira}`;
    const container = UI.get('mangueirasContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'mangueira-linha';
    div.id = `linhaM_${id}`;
    div.innerHTML = `
        <span class="linha-num">#${contadorMangueira}</span>

        <div>
            <label for="${id}">Mangueira</label>
            <select id="${id}"></select>
            <div class="descricao" id="desc_${id}">Selecione a mangueira.</div>
        </div>

        <div>
            <label for="mm_${id}">Comprimento (mm)</label>
            <input type="number" id="mm_${id}" min="1" placeholder="Ex: 500">
            <div class="info-mm" id="conv_${id}">Digite o comprimento.</div>
        </div>

        <div>
            <label for="valor_${id}">Valor/metro</label>
            <input type="text" id="valor_${id}" placeholder="0,00" readonly>
        </div>

        <div class="ipi-item" id="ipiWrap_${id}" hidden>
            <label for="ipi_${id}">IPI desta mangueira (%)</label>
            <input type="number" id="ipi_${id}" min="0" max="100" step="0.01" value="0" data-ipi-item="${id}">
            <div class="ipi-resumo" id="ipiResumo_${id}"></div>
        </div>

        <button type="button" class="btn-remove-linha" data-remove-mangueira="${id}" aria-label="Remover mangueira ${contadorMangueira}" title="Remover">×</button>
    `;
    container.appendChild(div);

    if (dados.mangueiras.length > 0) {
        carregarSelect(id, dados.mangueiras, true);
    }

    document.getElementById(`mm_${id}`)?.addEventListener('input', function () {
        const mm = Number(this.value);
        const conv = document.getElementById(`conv_${id}`);
        if (conv) {
            if (!mm) { conv.innerHTML = 'Digite o comprimento.'; return; }
            const m = mm / 1000, cm = mm / 10;
            conv.innerHTML = m >= 1
                ? `Equivale a: <b>${m.toFixed(2)} m</b> • ${cm.toFixed(0)} cm`
                : `Equivale a: <b>${cm.toFixed(0)} cm</b>`;
        }
        atualizarResumoIpiItem(id, true);
        autoCalcular();
    });
}

function removerLinhaMangueira(id) {
    const linha = UI.get(`linhaM_${id}`);
    if (linha) {
        if (tomSelects[id]) { tomSelects[id].destroy(); delete tomSelects[id]; }
        linha.remove();
    }
    autoCalcular();
}

/* Terminais */
let contadorTerminal = 0;

function adicionarLinhaTerminal() {
    if (state.catalogo !== 'ready') {
        alert('Aguarde o carregamento do catálogo de produtos.');
        return;
    }
    const temFaturamento = Boolean(UI.get('faturamento')?.value);
    if (!temFaturamento) {
        alert('Selecione o faturamento primeiro.');
        return;
    }

    contadorTerminal++;
    const id = `terminalExtra${contadorTerminal}`;
    const container = UI.get('terminaisExtrasContainer');
    if (!container) return;

    const div = document.createElement('div');
    div.className = 'terminal-extra-linha';
    div.id = `linhaT_${id}`;
    div.innerHTML = `
        <div>
            <label for="${id}">Terminal Extra ${contadorTerminal}</label>
            <select id="${id}"></select>
            <div class="descricao" id="desc_${id}">Opcional.</div>
        </div>

        <div>
            <label for="qty_${id}">Qtd.</label>
            <div class="terminal-qty-control">
                <button type="button" class="terminal-qty-btn btn-minus"
                    data-terminal-qty="${id}" data-delta="-1" aria-label="Diminuir quantidade do terminal extra ${contadorTerminal}" title="Diminuir">−</button>
                <input type="number" id="qty_${id}" value="1" min="1" max="9999"
                    data-terminal-input="${id}">
                <button type="button" class="terminal-qty-btn"
                    data-terminal-qty="${id}" data-delta="1" aria-label="Aumentar quantidade do terminal extra ${contadorTerminal}" title="Aumentar">+</button>
            </div>
        </div>

        <div>
            <label for="valor_${id}">Vl. unit.</label>
            <input type="text" id="valor_${id}" placeholder="0,00" readonly>
        </div>

        <div>
            <label for="valortotal_${id}">Vl. total</label>
            <input type="text" id="valortotal_${id}" placeholder="0,00" readonly>
        </div>

        <div class="ipi-item" id="ipiWrap_${id}" hidden>
            <label for="ipi_${id}">IPI deste terminal (%)</label>
            <input type="number" id="ipi_${id}" min="0" max="100" step="0.01" value="0" data-ipi-item="${id}">
            <div class="ipi-resumo" id="ipiResumo_${id}"></div>
        </div>

        <button type="button" class="btn-remove-linha" data-remove-terminal="${id}" aria-label="Remover terminal extra ${contadorTerminal}" title="Remover">×</button>
    `;
    container.appendChild(div);

    if (dados.terminais.length > 0) {
        carregarSelect(id, dados.terminais, false);
    }
}

function removerLinhaTerminal(id) {
    const linha = UI.get(`linhaT_${id}`);
    if (linha) {
        if (tomSelects[id]) { tomSelects[id].destroy(); delete tomSelects[id]; }
        linha.remove();
    }
    autoCalcular();
}

function getQtdTerminalExtra(id) {
    return Math.max(1, Number(UI.get(`qty_${id}`)?.value || 1));
}

function atualizarTotalTerminalExtra(id) {
    const precoUnit = valor(`valor_${id}`);
    const qty = getQtdTerminalExtra(id);
    const total = precoUnit * qty;
    const elTotal = UI.get(`valortotal_${id}`);
    if (elTotal) elTotal.value = total > 0 ? moedaInput(total) : '';
    atualizarResumoIpiItem(id, false);
}

function getIpiPercentual(id) {
    const campo = UI.get(`ipi_${id}`);
    const percentual = Math.max(0, Math.min(Number(campo?.value || 0), 100));
    if (campo && Number(campo.value) !== percentual) campo.value = percentual;
    return percentual;
}

function calcularValorItemComIpi(id, isMangueira) {
    let base = 0;
    if (isMangueira) {
        const mm = Number(UI.get(`mm_${id}`)?.value || 0);
        base = (valor(`valor_${id}`) / 1000) * mm;
    } else {
        const valorId = id === 'terminalA' ? 'valorTerminalA'
            : id === 'terminalB' ? 'valorTerminalB'
            : `valor_${id}`;
        const quantidade = ['terminalA', 'terminalB'].includes(id) ? 1 : getQtdTerminalExtra(id);
        base = valor(valorId) * quantidade;
    }
    return SimuladorLogic.calcularItemComIpi(base, getIpiPercentual(id));
}

function atualizarResumoIpiItem(id, isMangueira) {
    const selecionado = SimuladorLogic.componenteSelecionado(UI.get(id)?.value);
    const wrap = UI.get(`ipiWrap_${id}`);
    if (wrap) wrap.hidden = !selecionado;
    if (!selecionado) {
        UI.setValue(`ipi_${id}`, '0');
        UI.setHTML(`ipiResumo_${id}`, '');
        return;
    }
    const calculo = calcularValorItemComIpi(id, isMangueira);
    const baseIncompleta = calculo.base <= 0;
    UI.setHTML(`ipiResumo_${id}`, baseIncompleta
        ? 'Informe os dados do item para calcular o IPI.'
        : `IPI: <b>${moeda(calculo.ipi)}</b> • Total do item: <b>${moeda(calculo.total)}</b>`);
}

function alterarQtdTerminalExtra(id, delta) {
    const input = UI.get(`qty_${id}`);
    if (!input) return;
    const novo = Math.max(1, Number(input.value || 1) + delta);
    input.value = novo;
    // Desabilita botão − quando qty = 1
    const btnMinus = input.closest('.terminal-qty-control')?.querySelector('.btn-minus');
    if (btnMinus) btnMinus.disabled = novo <= 1;
    atualizarTotalTerminalExtra(id);
    autoCalcular();
}

function setQtdTerminalExtra(id, novoValor) {
    const input = UI.get(`qty_${id}`);
    if (!input) return;
    const novo = Math.max(1, Number(novoValor) || 1);
    input.value = novo;
    const btnMinus = input.closest('.terminal-qty-control')?.querySelector('.btn-minus');
    if (btnMinus) btnMinus.disabled = novo <= 1;
    atualizarTotalTerminalExtra(id);
    autoCalcular();
}

/* Preços */
function mostrarDescricaoSelect(id, isMangueira) {
    const faturamento = UI.get('faturamento')?.value;
    if (!faturamento) {
        alert('Selecione o faturamento primeiro.');
        return;
    }

    const select = document.getElementById(id);
    if (!select) return;
    const value = select.value;
    const descId  = id === 'terminalA' ? 'descTerminalA'
                  : id === 'terminalB' ? 'descTerminalB'
                  : `desc_${id}`;
    const valorId = id === 'terminalA' ? 'valorTerminalA'
                  : id === 'terminalB' ? 'valorTerminalB'
                  : `valor_${id}`;

    if (!value || value === 'na') {
        UI.setHTML(descId, isMangueira ? 'Selecione a mangueira.' : 'Opcional.');
        UI.setValue(valorId, '');
        atualizarResumoIpiItem(id, isMangueira);
        return;
    }

    const lista = isMangueira ? dados.mangueiras : dados.terminais;
    const item  = lista.find(i => i.codigo === value);
    if (!item) return;

    const preco = SimuladorLogic.numeroDeMoeda(item[faturamento]);
    atualizarState(id, preco);

    if (isMangueira) {
        UI.setHTML(descId, `<b>Valor por metro: ${moeda(preco)}</b>`);
        UI.setValue(valorId, moedaInput(preco));
    } else {
        UI.setHTML(descId, `${escaparHTML(item.descricao || '')}<br><b>Valor unit.: ${moeda(preco)}</b>`);
        UI.setValue(valorId, moedaInput(preco));
        if (!['terminalA', 'terminalB'].includes(id)) {
            atualizarTotalTerminalExtra(id);
        }
    }
    atualizarResumoIpiItem(id, isMangueira);
}

// Terminais fixos A/B com callback próprio
function initTerminaisFixos() {
    ['terminalA', 'terminalB'].forEach(id => {
        const sel = UI.get(id);
        if (!sel) return;
        sel.onchange = () => {
            mostrarDescricaoSelect(id, false);
            autoCalcular();
        };
    });
}

/* Faturamento */
const faturamentoSelect = document.getElementById('faturamento');
if (faturamentoSelect) {
    state.faturamento = faturamentoSelect.value;
    faturamentoSelect.addEventListener('change', () => {
        state.faturamento = faturamentoSelect.value;
        sincronizarEstadoControles();
        atualizarTodosValores();
        invalidarResultado();
    });
}

function atualizarTodosValores() {
    getMangueiraIds().forEach(id => mostrarDescricaoSelect(id, true));
    getTerminalIds().forEach(id => mostrarDescricaoSelect(id, false));
}

/* Formatação */
function formatarMoeda(input) {
    input.addEventListener('input', e => {
        let v = e.target.value.replace(/\D/g, '');
        if (!v) { e.target.value = ''; return; }
        e.target.value = (Number(v) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    });
}

document.querySelectorAll('#prensagem, #embalagem').forEach(input => {
    formatarMoeda(input);
});

/* Valores */
function moeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function moedaInput(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
}

function numeroDeMoeda(value) {
    return SimuladorLogic.numeroDeMoeda(value);
}

function valor(id) {
    const campo = document.getElementById(id);
    if (!campo) return 0;
    return numeroDeMoeda(campo.value);
}

/* Cálculo */
function calcularTotal(inputs) {
    return SimuladorLogic.calcularTotal(inputs);
}

/* Cálculo principal */
function calcular() {
    if (kits.length > 0) {
        const faturamento = UI.get('faturamento')?.value;
        if (faturamento) {
            recalcularKitsSalvos(faturamento);
            renderizarKits();
        }
        atualizarResultadoOrcamento();
        return;
    }
    const mangueiraIds = getMangueiraIds();
    if (mangueiraIds.length === 0) {
        alert('Adicione ao menos uma mangueira.');
        return;
    }

    let totalMangueiras = 0;
    let totalIpi = 0;
    let algumaMangueiraComValor = false;

    for (const mid of mangueiraIds) {
        const mm = Number(document.getElementById(`mm_${mid}`)?.value || 0);
        const vMetro = valor(`valor_${mid}`);
        if (mm > 0 && vMetro > 0) {
            const item = calcularValorItemComIpi(mid, true);
            totalMangueiras += item.total;
            totalIpi += item.ipi;
            algumaMangueiraComValor = true;
        }
    }

    if (!algumaMangueiraComValor) {
        alert('Informe o comprimento e selecione a mangueira.');
        return;
    }

    const terminais = getTerminalIds().map(id => {
        const item = calcularValorItemComIpi(id, false);
        totalIpi += item.ipi;
        return item.total;
    });

    const resultado = calcularTotal({
        mangueiras: totalMangueiras,
        terminais,
        prensagem: valor('prensagem'),
        embalagem: valor('embalagem'),
        ipiTotal: totalIpi,
        desconto: Number(UI.get('desconto')?.value || 0)
    });

    UI.setHTML('resultado', `
        <div class="resultado-item">
            <span>Produtos com IPI</span>
            <span>${moeda(resultado.produtos)}</span>
        </div>
        <div class="resultado-item">
            <span>IPI incluído por item</span>
            <span>${moeda(resultado.ipi)}</span>
        </div>
        <div class="resultado-item">
            <span>Desconto</span>
            <span>${moeda(resultado.desconto)}</span>
        </div>
        <div class="resultado-item">
            <span class="total">TOTAL FINAL</span>
            <span class="total">${moeda(resultado.total)}</span>
        </div>
        ${blocoObservacoesResultado()}
    `);
    const el = document.getElementById('resultado');
    if (el) el.dataset.calculado = '1';
}

/* Recálculo */
function invalidarResultado() {
    const resultado = document.getElementById('resultado');
    if (!resultado) return;
    resultado.innerHTML = '';
    delete resultado.dataset.calculado;
}

function autoCalcular() {
    invalidarResultado();
}

['prensagem', 'embalagem'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', autoCalcular);
});
const descontoInput = document.getElementById('desconto');
if (descontoInput) {
    descontoInput.addEventListener('input', () => {
        let v = Number(descontoInput.value);
        if (v > 25) {
            descontoInput.value = 25;
            descontoInput.classList.add('campo-limite');
            setTimeout(() => descontoInput.classList.remove('campo-limite'), 1200);
        } else {
            descontoInput.classList.remove('campo-limite');
        }
        autoCalcular();
    });
}

/* Orçamento impresso */
let kits = [];
let kitEmEdicaoId = null;

function gerarKitId() {
    return `kit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function textoSelecionado(id) {
    const select = document.getElementById(id);
    if (!select) return '';
    if (tomSelects[id]) {
        const item = tomSelects[id].options[select.value];
        return item ? item.text : '';
    }
    const option = select.options[select.selectedIndex];
    return option ? option.text : '';
}

function escaparHTML(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function obterValoresKitAtual() {
    const mangueiraIds = getMangueiraIds();
    let totalMangueiras = 0;
    let totalIpi = 0;

    mangueiraIds.forEach(mid => {
        const mm = Number(document.getElementById(`mm_${mid}`)?.value || 0);
        const vMetro = valor(`valor_${mid}`);
        if (mm > 0 && vMetro > 0) {
            const item = calcularValorItemComIpi(mid, true);
            totalMangueiras += item.total;
            totalIpi += item.ipi;
        }
    });

    const terminais = getTerminalIds().map(id => {
        const item = calcularValorItemComIpi(id, false);
        totalIpi += item.ipi;
        return item.total;
    });

    return calcularTotal({ mangueiras: totalMangueiras, terminais, ipiTotal: totalIpi, prensagem: 0, embalagem: 0, desconto: 0 });
}

function obterDadosKitDoFormulario() {
    const calculo = obterValoresKitAtual();
    const terminalIds = getTerminalIds();

    const mangueirasDoFormulario = getMangueiraIds().map(mid => ({
        id: mid,
        value: UI.get(mid)?.value || '',
        texto: textoSelecionado(mid),
        mm: UI.get(`mm_${mid}`)?.value || '',
        ipi: getIpiPercentual(mid)
    })).filter(m => m.value);

    return {
        nome: String(UI.get('nomeKit')?.value || '').trim(),
        faturamento: UI.get('faturamento')?.value || '',
        mangueiras: mangueirasDoFormulario,
        conjunto1: UI.get('terminalA')?.value || '',
        conjunto1Texto: textoSelecionado('terminalA'),
        conjunto1Ipi: getIpiPercentual('terminalA'),
        conjunto2: UI.get('terminalB')?.value || '',
        conjunto2Texto: textoSelecionado('terminalB'),
        conjunto2Ipi: getIpiPercentual('terminalB'),
        terminaisExtras: terminalIds
            .filter(id => !['terminalA', 'terminalB'].includes(id))
            .map(id => ({
                id,
                value: UI.get(id)?.value || '',
                texto: textoSelecionado(id),
                qty: getQtdTerminalExtra(id),
                ipi: getIpiPercentual(id)
            })),
        subtotal: calculo.subtotal,
        ipiTotal: calculo.ipi,
        descontoValor: calculo.desconto,
        total: calculo.total
    };
}

function validarKit(kit) {
    const erro = SimuladorLogic.erroValidacaoKit(kit);
    if (erro) alert(erro);
    return !erro;
}

function salvarKit() {
    const kit = obterDadosKitDoFormulario();
    if (!validarKit(kit)) return;

    if (kitEmEdicaoId) {
        kits = kits.map(item => item.id !== kitEmEdicaoId ? item : { ...item, ...kit, id: kitEmEdicaoId });
        kitEmEdicaoId = null;
        UI.get('btnSalvarKit').innerHTML = 'SALVAR KIT';
        UI.get('btnCancelarEdicaoKit').hidden = true;
    } else {
        kits.push({ id: gerarKitId(), quantidade: 1, ...kit });
    }

    limparFormularioKit();
    renderizarKits();
}

function limparFormularioKit() {
    UI.setValue('nomeKit', '');
    document.querySelectorAll('.mangueira-linha').forEach(linha => {
        const sel = linha.querySelector('select');
        if (sel && tomSelects[sel.id]) { tomSelects[sel.id].destroy(); delete tomSelects[sel.id]; }
        linha.remove();
    });
    contadorMangueira = 0;
    ['terminalA', 'terminalB'].forEach(id => {
        setSelectValue(id, '');
        UI.setHTML(id === 'terminalA' ? 'descTerminalA' : 'descTerminalB', 'Selecione o terminal principal.');
        UI.setValue(id === 'terminalA' ? 'valorTerminalA' : 'valorTerminalB', '');
        UI.setValue(`ipi_${id}`, '0');
        atualizarResumoIpiItem(id, false);
    });
    document.querySelectorAll('.terminal-extra-linha').forEach(linha => {
        const sel = linha.querySelector('select');
        if (sel && tomSelects[sel.id]) { tomSelects[sel.id].destroy(); delete tomSelects[sel.id]; }
        linha.remove();
    });
    contadorTerminal = 0;

    UI.setHTML('resultado', '');
    const elRes = document.getElementById('resultado');
    if (elRes) delete elRes.dataset.calculado;
}

/* Quantidade de kits */
function alterarQuantidadeKit(id, delta) {
    const kit = kits.find(k => k.id === id);
    if (!kit) return;
    kit.quantidade = Math.max(1, Number(kit.quantidade || 1) + delta);
    invalidarResultado();
    renderizarKits();
}

function setQuantidadeKit(id, novoValor) {
    const kit = kits.find(k => k.id === id);
    if (!kit) return;
    kit.quantidade = Math.max(1, Number(novoValor) || 1);
    invalidarResultado();
    renderizarKits();
}

/* Lista de kits */
function resumoMangueiras(kit) {
    return (kit.mangueiras || []).map(m =>
        `<span>Mangueira: ${escaparHTML(m.texto)}${m.mm ? ' — ' + m.mm + ' mm' : ''}${Number(m.ipi) > 0 ? ` — IPI ${Number(m.ipi)}%` : ''}</span>`
    ).join('');
}

function resumoItensExtras(kit) {
    const extras = (kit.terminaisExtras || [])
        .filter(item => item.value && item.value !== 'na')
        .map(item => {
            const qty = Number(item.qty || 1);
            const texto = qty > 1 ? `${item.texto} ×${qty}` : item.texto;
            return `${texto}${Number(item.ipi) > 0 ? ` — IPI ${Number(item.ipi)}%` : ''}`;
        });
    if (extras.length === 0) return '';
    return `<span>Extras: ${extras.map(escaparHTML).join(' | ')}</span>`;
}

function renderizarKits() {
    const container = document.getElementById('kitsLista');
    if (!container) return;

    if (kits.length === 0) {
        container.innerHTML = `<div class="kits-vazio">Nenhum kit cadastrado ainda.</div>`;
        return;
    }

    const totais = calcularOrcamentoTotal();

    container.innerHTML = kits.map(kit => {
        const qty = Number(kit.quantidade || 1);
        const totalKit = Number(kit.total || 0) * qty;
        const id = kit.id;

        return `
        <div class="kit-item">
            <div class="kit-info">
                <strong>${escaparHTML(kit.nome)}</strong>
                ${resumoMangueiras(kit)}
                ${kit.conjunto1Texto ? `<span>Terminal A: ${escaparHTML(kit.conjunto1Texto)}${Number(kit.conjunto1Ipi) > 0 ? ` — IPI ${Number(kit.conjunto1Ipi)}%` : ''}</span>` : ''}
                ${kit.conjunto2Texto ? `<span>Terminal B: ${escaparHTML(kit.conjunto2Texto)}${Number(kit.conjunto2Ipi) > 0 ? ` — IPI ${Number(kit.conjunto2Ipi)}%` : ''}</span>` : ''}
                ${resumoItensExtras(kit)}
            </div>

            <div class="kit-qty-wrap">
                <span class="kit-qty-label">Quantidade</span>
                <div class="kit-qty-control">
                    <button type="button" class="kit-qty-btn btn-minus"
                        data-kit-qty="${id}" data-delta="-1"
                        ${qty <= 1 ? 'disabled' : ''}>−</button>
                    <input type="number" min="1" value="${qty}"
                        data-kit-input="${id}">
                    <button type="button" class="kit-qty-btn"
                        data-kit-qty="${id}" data-delta="1">+</button>
                </div>
                <span class="kit-valor">${moeda(totalKit)}</span>
            </div>

            <div class="kit-acoes">
                <button type="button" data-kit-action="editar" data-kit-id="${id}">EDITAR</button>
                <button type="button" data-kit-action="duplicar" data-kit-id="${id}">DUPLICAR</button>
                <button type="button" data-kit-action="excluir" data-kit-id="${id}" class="btn-perigo">EXCLUIR</button>
            </div>
        </div>`;
    }).join('') + `
        <div class="kits-total-geral">
            <span>PRODUTOS: ${moeda(totais.totalProdutos)}</span>
            <strong>TOTAL: ${moeda(totais.totalFinal)}</strong>
        </div>`;

    atualizarPreviewOrcamento();
}

/* Kits salvos */
function buscarItem(lista, codigo) {
    if (!codigo || codigo === 'na') return null;
    return lista.find(item => item.codigo === codigo) || null;
}

function precoItem(lista, codigo, faturamento) {
    const item = buscarItem(lista, codigo);
    if (!item) return 0;
    return SimuladorLogic.numeroDeMoeda(item[faturamento]);
}

function textoItem(lista, codigo, fallback) {
    const item = buscarItem(lista, codigo);
    if (!item) return fallback || '';
    return `${item.codigo}${item.descricao ? ' – ' + item.descricao : ''}`;
}

function recalcularKit(kit, faturamento) {
    let totalMangueiras = 0;
    let totalIpi = 0;
    const mangueirasAtualizadas = (kit.mangueiras || []).map(m => {
        const mm = Number(m.mm || 0);
        const preco = precoItem(dados.mangueiras, m.value, faturamento);
        const item = SimuladorLogic.calcularItemComIpi((preco / 1000) * mm, m.ipi);
        if (mm > 0 && preco > 0) {
            totalMangueiras += item.total;
            totalIpi += item.ipi;
        }
        return { ...m, texto: textoItem(dados.mangueiras, m.value, m.texto) };
    });

    const terminaisPrincipais = [
        { codigo: kit.conjunto1, ipi: kit.conjunto1Ipi },
        { codigo: kit.conjunto2, ipi: kit.conjunto2Ipi }
    ].map(terminal => {
        const item = SimuladorLogic.calcularItemComIpi(
            precoItem(dados.terminais, terminal.codigo, faturamento),
            terminal.ipi
        );
        totalIpi += item.ipi;
        return item.total;
    });
    const terminaisExtras = (kit.terminaisExtras || [])
        .map(extra => {
            const base = precoItem(dados.terminais, extra.value, faturamento) * Number(extra.qty || 1);
            const item = SimuladorLogic.calcularItemComIpi(base, extra.ipi);
            totalIpi += item.ipi;
            return item.total;
        });

    const calculo = calcularTotal({
        mangueiras: totalMangueiras,
        terminais: [...terminaisPrincipais, ...terminaisExtras],
        ipiTotal: totalIpi,
        prensagem: 0, embalagem: 0, desconto: 0
    });

    return {
        ...kit,
        faturamento,
        mangueiras: mangueirasAtualizadas,
        conjunto1Texto: textoItem(dados.terminais, kit.conjunto1, kit.conjunto1Texto),
        conjunto2Texto: textoItem(dados.terminais, kit.conjunto2, kit.conjunto2Texto),
        terminaisExtras: (kit.terminaisExtras || []).map(extra => ({
            ...extra,
            texto: textoItem(dados.terminais, extra.value, extra.texto)
        })),
        subtotal: calculo.subtotal,
        ipiTotal: calculo.ipi,
        descontoValor: calculo.desconto,
        total: calculo.total
    };
}

function recalcularKitsSalvos(faturamento) {
    if (!faturamento || kits.length === 0) return;
    kits = kits.map(kit => recalcularKit(kit, faturamento));
}

/* Totais */
function calcularOrcamentoTotal() {
    const totalProdutos = kits.reduce((acc, kit) =>
        acc + Number(kit.total || 0) * Number(kit.quantidade || 1), 0);
    const ipiValor = kits.reduce((acc, kit) =>
        acc + Number(kit.ipiTotal || 0) * Number(kit.quantidade || 1), 0);
    const produtosSemIpi = totalProdutos - ipiValor;
    const prensagem = valor('prensagem');
    const embalagem = valor('embalagem');
    const subtotal  = totalProdutos + prensagem + embalagem;
    const descontoPercentual = Math.max(0, Math.min(Number(UI.get('desconto')?.value || 0), 25));
    const descontoValor = subtotal * (descontoPercentual / 100);
    return { totalProdutos, produtosSemIpi, ipiValor, prensagem, embalagem, subtotal, descontoPercentual, descontoValor, totalFinal: subtotal - descontoValor };
}

function atualizarResultadoOrcamento() {
    const t = calcularOrcamentoTotal();
    UI.setHTML('resultado', `
        <div class="resultado-item"><span>Total dos produtos</span><span>${moeda(t.totalProdutos)}</span></div>
        <div class="resultado-item"><span>IPI incluído por item</span><span>${moeda(t.ipiValor)}</span></div>
        <div class="resultado-item"><span>Prensagem</span><span>${moeda(t.prensagem)}</span></div>
        <div class="resultado-item"><span>Embalagem</span><span>${moeda(t.embalagem)}</span></div>
        <div class="resultado-item"><span>Desconto (${t.descontoPercentual}%)</span><span>${moeda(t.descontoValor)}</span></div>
        <div class="resultado-item"><span class="total">TOTAL DO ORÇAMENTO</span><span class="total">${moeda(t.totalFinal)}</span></div>
        ${blocoObservacoesResultado()}
    `);
    const el = document.getElementById('resultado');
    if (el) el.dataset.calculado = '1';
}

/* Edição de kits */
function editarKit(id) {
    const kit = kits.find(item => item.id === id);
    if (!kit) return;
    const fatSelect = document.getElementById('faturamento');
    if (fatSelect && fatSelect.value !== kit.faturamento) {
        fatSelect.value = kit.faturamento;
        state.faturamento = kit.faturamento;
        sincronizarEstadoControles();
        atualizarTodosValores();
    }
    limparFormularioKit();
    kitEmEdicaoId = id;
    UI.setValue('nomeKit', kit.nome);
    (kit.mangueiras || []).forEach(m => {
        adicionarLinhaMangueira();
        const mid = `mangueira${contadorMangueira}`;
        setTimeout(() => {
            setSelectValue(mid, m.value);
            UI.setValue(`mm_${mid}`, m.mm);
            UI.setValue(`ipi_${mid}`, m.ipi || 0);
            mostrarDescricaoSelect(mid, true);
        }, 100);
    });
    setTimeout(() => {
        setSelectValue('terminalA', kit.conjunto1);
        setSelectValue('terminalB', kit.conjunto2);
        UI.setValue('ipi_terminalA', kit.conjunto1Ipi || 0);
        UI.setValue('ipi_terminalB', kit.conjunto2Ipi || 0);
        mostrarDescricaoSelect('terminalA', false);
        mostrarDescricaoSelect('terminalB', false);
    }, 50);
    (kit.terminaisExtras || []).filter(e => e.value && e.value !== 'na').forEach(extra => {
        adicionarLinhaTerminal();
        const tid = `terminalExtra${contadorTerminal}`;
        setTimeout(() => {
            setSelectValue(tid, extra.value);
            UI.setValue(`ipi_${tid}`, extra.ipi || 0);
            mostrarDescricaoSelect(tid, false);
            // Restaura a quantidade salva
            const qty = Number(extra.qty || 1);
            if (qty > 1) setQtdTerminalExtra(tid, qty);
        }, 100);
    });

    UI.get('btnSalvarKit').innerHTML = 'ATUALIZAR KIT';
    UI.get('btnCancelarEdicaoKit').hidden = false;

    document.querySelector('.kits-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function duplicarKit(id) {
    const kit = kits.find(item => item.id === id);
    if (!kit) return;

    const novoNome = prompt('Nome do novo kit:', `Cópia de ${kit.nome}`);
    if (!novoNome || !novoNome.trim()) return;

    kits.push({ ...kit, id: gerarKitId(), nome: novoNome.trim(), quantidade: 1 });
    invalidarResultado();
    renderizarKits();
}

function excluirKit(id) {
    const kit = kits.find(item => item.id === id);
    if (!kit) return;
    if (!confirm(`Deseja excluir o kit "${kit.nome}"?`)) return;

    kits = kits.filter(item => item.id !== id);
    if (kitEmEdicaoId === id) cancelarEdicaoKit();
    invalidarResultado();
    renderizarKits();
}

function cancelarEdicaoKit() {
    kitEmEdicaoId = null;
    UI.get('btnSalvarKit').innerHTML = 'SALVAR KIT';
    UI.get('btnCancelarEdicaoKit').hidden = true;
    limparFormularioKit();
}

/* Dados da empresa */
const EMPRESAS_KORAX = {
    sp: {
        orcNossaEmpresa:       'sp',
        orcEmpresaNome:        'EQUIP DISTRIBUIDORA DE MANGUEIRAS LTDA',
        orcEmpresaCnpj:        '08.786.020/0001-41',
        orcEmpresaIe:          '149.660.014.119',
        orcEmpresaLogradouro:  'R PROF PEDREIRA DE FREITAS',
        orcEmpresaNumero:      '1136',
        orcEmpresaBairro:      'VILA GOMES CARDIM',
        orcEmpresaCep:         '03312-052',
        orcEmpresaSite:        'www.korax.com.br',
        orcEmpresaFone:        '(11) 2227-8010',
        orcEmpresaCidade:      'São Paulo',
        orcEmpresaUf:          'SP',
        orcEmpresaEndereco:    'R PROF PEDREIRA DE FREITAS, 1136',
        orcFrete:              'Destinatário'
    },
    sc: {
        orcNossaEmpresa:       'sc',
        orcEmpresaNome:        'EQUIP DISTRIBUIDORA DE MANGUEIRAS LTDA - SC',
        orcEmpresaCnpj:        '08.786.020/0003-03',
        orcEmpresaIe:          '261222104',
        orcEmpresaLogradouro:  'BR 101, KM 23',
        orcEmpresaNumero:      'S/N',
        orcEmpresaBairro:      'Rio Bonito (Pirabeiraba)',
        orcEmpresaCep:         '89239-500',
        orcEmpresaSite:        'www.korax.com.br',
        orcEmpresaFone:        '112076-5680',
        orcEmpresaCidade:      'Joinville',
        orcEmpresaUf:          'SC',
        orcEmpresaEndereco:    'BR 101, KM 23, S/N',
        orcFrete:              'Destinatário'
    }
};

const ORCAMENTO_PADRAO = EMPRESAS_KORAX.sc;

// IDs dos campos que pertencem SOMENTE à empresa (sempre pré-preenchidos)
const CAMPOS_EMPRESA = Object.keys(ORCAMENTO_PADRAO);

function initMemoriaOrcamento() {
    let empresaSalva = {};
    try { empresaSalva = JSON.parse(localStorage.getItem('korax_empresa_v1') || '{}'); } catch(e) {}
    const empresaEscolhida = EMPRESAS_KORAX[empresaSalva.orcNossaEmpresa] ? empresaSalva.orcNossaEmpresa : ORCAMENTO_PADRAO.orcNossaEmpresa;
    const dadosEmpresa = { ...EMPRESAS_KORAX[empresaEscolhida], orcFrete: empresaSalva.orcFrete || ORCAMENTO_PADRAO.orcFrete };
    CAMPOS_EMPRESA.forEach(id => {
        const campo = document.getElementById(id);
        if (campo && dadosEmpresa[id] != null) {
            campo.value = dadosEmpresa[id];
        }
        if (campo) {
            campo.addEventListener('input',  salvarDadosEmpresa);
            campo.addEventListener('change', salvarDadosEmpresa);
        }
    });

    const selectEmpresa = document.getElementById('orcNossaEmpresa');
    if (selectEmpresa) {
        selectEmpresa.addEventListener('change', () => aplicarEmpresaSelecionada(selectEmpresa.value, true));
    }
    const dataEl = document.getElementById('orcData');
    if (dataEl && !dataEl.value) {
        const agora = new Date();
        const local = new Date(agora.getTime() - agora.getTimezoneOffset() * 60000);
        dataEl.value = local.toISOString().slice(0, 10);
    }
}

function aplicarEmpresaSelecionada(chave, salvar = false) {
    const dadosEmpresa = EMPRESAS_KORAX[chave] || EMPRESAS_KORAX.sc;
    CAMPOS_EMPRESA.forEach(id => {
        if (id === 'orcFrete') return;
        const campo = document.getElementById(id);
        if (campo && dadosEmpresa[id] != null) campo.value = dadosEmpresa[id];
    });
    if (salvar) salvarDadosEmpresa();
    atualizarPreviewOrcamento();
}

function salvarDadosEmpresa() {
    const d = {};
    CAMPOS_EMPRESA.forEach(id => {
        const campo = document.getElementById(id);
        if (campo) d[id] = campo.value;
    });
    try { localStorage.setItem('korax_empresa_v1', JSON.stringify(d)); } catch(e) {}
}

function campoOrcamento(id) { return UI.get(id)?.value || ''; }

function formatarDataBR(value) {
    if (!value) return '';
    const p = value.split('-');
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : value;
}

/* Máscaras */
function mascaraCNPJ(v) {
    v = v.replace(/\D/g, '').substring(0, 14);
    let out = '';
    if (v.length > 0) out += v.substring(0, 2);
    if (v.length > 2) out += '.' + v.substring(2, 5);
    if (v.length > 5) out += '.' + v.substring(5, 8);
    if (v.length > 8) out += '/' + v.substring(8, 12);
    if (v.length > 12) out += '-' + v.substring(12, 14);
    return out;
}

function mascaraTelefone(v) {
    v = v.replace(/\D/g, '');
    return v.length <= 10
        ? v.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, '($1) $2-$3')
        : v.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, '($1) $2-$3');
}

document.querySelectorAll('#orcEmpresaCnpj, #orcClienteCnpj').forEach(input => {
    input.addEventListener('input', e => { e.target.value = mascaraCNPJ(e.target.value); });
});

document.querySelectorAll('#orcEmpresaFone, #orcVendedorTelefone, #orcClienteTelefone').forEach(input => {
    input.addEventListener('input', e => { e.target.value = mascaraTelefone(e.target.value); });
});

/* Orçamento impresso */
function montarHtmlOrcamento() {
    const totais = calcularOrcamentoTotal();
    // No documento do cliente, os preços dos kits já são líquidos do desconto.
    // Assim, a alíquota e o valor concedido permanecem apenas na tela interna.
    const fatorPrecoCliente = 1 - (totais.descontoPercentual / 100);
    const titulo = campoOrcamento('orcTitulo') || 'Orçamento';
    const endEmpresa = [
        campoOrcamento('orcEmpresaLogradouro') || campoOrcamento('orcEmpresaEndereco'),
        campoOrcamento('orcEmpresaNumero')
    ].filter(Boolean).join(', ');
    const endEmpresaCompleto = [endEmpresa, campoOrcamento('orcEmpresaComplemento')].filter(Boolean).join(' – ');
    const endCliente = [
        campoOrcamento('orcClienteLogradouro') || campoOrcamento('orcClienteEndereco'),
        campoOrcamento('orcClienteNumero')
    ].filter(Boolean).join(', ');
    const endClienteCompleto = [endCliente, campoOrcamento('orcClienteComplemento')].filter(Boolean).join(' – ');
    let itemIndex = 0;
    const todasLinhas = [];
    kits.forEach(kit => {
        const qty = Number(kit.quantidade || 1);
        const totalKit = Number(kit.total || 0) * qty;
        itemIndex++;
        const detalheLinhas = [];
        (kit.mangueiras || []).forEach(m => {
            if (!m.texto) return;
            detalheLinhas.push(`Mangueira: ${m.texto}${m.mm ? ' — ' + m.mm + ' mm' : ''}${Number(m.ipi) > 0 ? ` — IPI ${Number(m.ipi)}%` : ''}`);
        });
        if (kit.conjunto1Texto) detalheLinhas.push(`Terminal A: ${kit.conjunto1Texto}${Number(kit.conjunto1Ipi) > 0 ? ` — IPI ${Number(kit.conjunto1Ipi)}%` : ''}`);
        if (kit.conjunto2Texto) detalheLinhas.push(`Terminal B: ${kit.conjunto2Texto}${Number(kit.conjunto2Ipi) > 0 ? ` — IPI ${Number(kit.conjunto2Ipi)}%` : ''}`);
        const extras = (kit.terminaisExtras || [])
            .filter(e => e.value && e.value !== 'na')
            .map(e => {
                const q = Number(e.qty || 1);
                const texto = q > 1 ? `${e.texto} ×${q}` : e.texto;
                return `${texto}${Number(e.ipi) > 0 ? ` — IPI ${Number(e.ipi)}%` : ''}`;
            });
        if (extras.length > 0) detalheLinhas.push(`Extras: ${extras.join(' | ')}`);

        todasLinhas.push({
            num: itemIndex,
            kitNome: kit.nome,
            detalheLinhas,
            qtdDisplay: qty,
            unidade: 'KIT',
            vUnit: Number(kit.total || 0) > 0 ? Number(kit.total || 0) * fatorPrecoCliente : null,
            vTotal: totalKit > 0 ? totalKit * fatorPrecoCliente : null
        });
    });

    return `
<section class="pdf-page">
<header class="pdf-header-v2">
        <div class="pdf-logo-area">
            <img src="img/logo.png" alt="Logo" crossorigin="anonymous">
        </div>
        <div class="pdf-empresa-box">
            <div class="pdf-empresa-nome">${escaparHTML(campoOrcamento('orcEmpresaNome'))}</div>
            <div class="pdf-empresa-info">
                <div class="pdf-info-full"><strong>End.:</strong> ${escaparHTML(endEmpresaCompleto)} — CEP ${escaparHTML(campoOrcamento('orcEmpresaCep'))}</div>
                <div><strong>CNPJ:</strong> ${escaparHTML(campoOrcamento('orcEmpresaCnpj'))}</div>
                <div><strong>IE:</strong> ${escaparHTML(campoOrcamento('orcEmpresaIe'))}</div>
                <div class="pdf-info-full"><strong>Tel:</strong> ${escaparHTML(campoOrcamento('orcEmpresaFone'))}&nbsp;&nbsp;<strong>E-mail:</strong> ${escaparHTML(campoOrcamento('orcVendedorEmail'))}</div>
            </div>
            <div class="pdf-empresa-orcamento">
                <div class="pdf-orc-grid">
                    <span><strong>Orçamento Nº:</strong> ${escaparHTML(campoOrcamento('orcNumero'))}</span>
                    <span><strong>Data:</strong> ${escaparHTML(formatarDataBR(campoOrcamento('orcData')))}</span>
                    <span><strong>Vendedor:</strong> ${escaparHTML(campoOrcamento('orcVendedor'))}</span>
                    <span><strong>Validade da Proposta:</strong> ${escaparHTML(campoOrcamento('orcValidade'))}</span>
                </div>
            </div>
        </div>
    </header>
<div class="pdf-separator-bar">
        <div class="pdf-sep-azul"></div>
        <div class="pdf-sep-amarelo"></div>
        <div class="pdf-sep-vermelho"></div>
    </div>
<div class="pdf-conteudo-principal">
<section class="pdf-secao-cliente">
        <div class="pdf-secao-titulo">DADOS DO CLIENTE</div>
        <table class="pdf-cliente-tabela">
            <colgroup>
                <col style="width:28mm">
                <col>
                <col style="width:28mm">
                <col>
            </colgroup>
            <tr>
                <td class="pdf-cli-label">Cliente / Empresa</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcCliente'))}</td>
                <td class="pdf-cli-label">CNPJ / CPF</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcClienteCnpj'))}</td>
            </tr>
            <tr>
                <td class="pdf-cli-label">Contato</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcContatoCliente'))}</td>
                <td class="pdf-cli-label">E-mail</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcClienteEmail'))}</td>
            </tr>
            <tr>
                <td class="pdf-cli-label">Endereço</td>
                <td class="pdf-cli-valor" colspan="3">${escaparHTML(endClienteCompleto)}${campoOrcamento('orcClienteBairro') ? ' — ' + escaparHTML(campoOrcamento('orcClienteBairro')) : ''}</td>
            </tr>
            <tr>
                <td class="pdf-cli-label">Cidade</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcClienteCidade'))}</td>
                <td class="pdf-cli-label">UF / CEP</td>
                <td class="pdf-cli-valor">${escaparHTML(campoOrcamento('orcClienteUf'))} — ${escaparHTML(campoOrcamento('orcClienteCep'))}</td>
            </tr>
        </table>
    </section>
<div class="pdf-titulo-orcamento">${escaparHTML(titulo)}</div>
<section class="pdf-secao-itens">
        <div class="pdf-secao-titulo">ITENS DO ORÇAMENTO</div>
        <table class="pdf-itens-tabela">
            <thead>
                <tr>
                    <th class="col-item">ITEM</th>
                    <th class="col-desc">DESCRIÇÃO</th>
                    <th class="col-qtd">QTD</th>
                    <th class="col-unid">UNID.</th>
                    <th class="col-vunit">VL. UNIT.</th>
                    <th class="col-vtotal">VL. TOTAL</th>
                </tr>
            </thead>
            <tbody>
                ${todasLinhas.map(linha => `
                <tr>
                    <td class="col-item cel-num">${linha.num}</td>
                    <td class="col-desc">
                        <strong class="pdf-kit-nome">${escaparHTML(linha.kitNome)}</strong>
                        ${linha.detalheLinhas.map(d => `<span class="pdf-kit-detalhe">${escaparHTML(d)}</span>`).join('')}
                    </td>
                    <td class="col-qtd">${linha.qtdDisplay}</td>
                    <td class="col-unid">${linha.unidade}</td>
                    <td class="col-vunit">${linha.vUnit != null ? moeda(linha.vUnit) : '—'}</td>
                    <td class="col-vtotal">${linha.vTotal != null ? moeda(linha.vTotal) : '—'}</td>
                </tr>`).join('')}
            </tbody>
        </table>
        <div class="pdf-itens-obs">* Especificações técnicas e demais medidas disponíveis sob consulta.</div>

        <table class="pdf-totais-tabela">
            <tr class="tot-final">
                <td class="tot-label">TOTAL GERAL</td>
                <td class="tot-valor">${moeda(totais.totalFinal)}</td>
            </tr>
        </table>
    </section>

    <div class="pdf-finalizacao">
<section class="pdf-obs">
            <div class="pdf-secao-titulo">OBSERVAÇÕES</div>
            <table class="pdf-obs-tabela">
                <tr>
                    <td><strong>Prazo de entrega:</strong> ${escaparHTML(campoOrcamento('orcPrazo'))}</td>
                    <td><strong>Pagamento:</strong> ${escaparHTML(campoOrcamento('orcPagamento'))}</td>
                </tr>
                <tr>
                    <td><strong>Validade da Proposta:</strong> ${escaparHTML(campoOrcamento('orcValidade'))}</td>
                    <td class="pdf-obs-aviso">Estoque e preço sujeitos a alteração com aviso prévio.</td>
                </tr>
            </table>
        </section>
<footer class="pdf-rodape-v2">
            <div class="pdf-rodape-sep">
                <div class="pdf-sep-azul"></div>
                <div class="pdf-sep-amarelo"></div>
                <div class="pdf-sep-vermelho"></div>
            </div>
            <div class="pdf-rodape-info">
                <span>${escaparHTML(campoOrcamento('orcEmpresaNome'))}</span>
                <span>Tel: ${escaparHTML(campoOrcamento('orcEmpresaFone'))}</span>
                <span>${escaparHTML(campoOrcamento('orcVendedorEmail'))}</span>
                <span>${escaparHTML(campoOrcamento('orcEmpresaSite'))}</span>
            </div>
            <div class="pdf-rodape-legal">${escaparHTML(AVISO_LEGAL_TEXTO.pdfRodape)}</div>
        </footer>
    </div>

    </div>

</section>`;
}

function ajustarRodapeOrcamento(area) {
    const finalizacao = area?.querySelector('.pdf-finalizacao');
    if (!finalizacao) return;

    finalizacao.style.marginTop = '';
}


function prepararOrcamentoParaPdf() {
    if (kits.length === 0) {
        alert('Salve pelo menos um kit antes de gerar o orçamento.');
        return null;
    }
    const area = UI.get('orcamentoPrintArea');
    if (!area) return null;
    area.innerHTML = montarHtmlOrcamento();
    ajustarRodapeOrcamento(area);
    return area;
}

async function gerarPdf() {
    const area = prepararOrcamentoParaPdf();
    if (!area) return;
    const nomeCliente = UI.get('orcCliente')?.value;
    if (nomeCliente) acSalvarNome(nomeCliente);
    const imgEl = area.querySelector('.pdf-logo-area img');
    if (imgEl) {
        await new Promise(resolve => {
            const canvas = document.createElement('canvas');
            const tmpImg = new Image();
            tmpImg.crossOrigin = 'anonymous';
            tmpImg.onload = () => {
                canvas.width = tmpImg.naturalWidth;
                canvas.height = tmpImg.naturalHeight;
                canvas.getContext('2d').drawImage(tmpImg, 0, 0);
                try {
                    imgEl.src = canvas.toDataURL('image/png');
                } catch(e) {}
                resolve();
            };
            tmpImg.onerror = resolve;
            tmpImg.src = 'img/logo.png?t=' + Date.now();
        });
    }

    ajustarRodapeOrcamento(area);

    window.print();
}

/* Prévia */
function atualizarPreviewOrcamento() {
    const conteudo = UI.get('previewConteudo');
    if (!conteudo) return;

    if (kits.length === 0) {
        conteudo.classList.add('preview-conteudo--vazio');
        conteudo.innerHTML = `
            <div class="preview-vazio">
                Salve pelo menos um kit para visualizar a prévia do orçamento.
            </div>`;
        return;
    }
    conteudo.classList.remove('preview-conteudo--vazio');
    conteudo.innerHTML = montarHtmlOrcamento();
    ajustarRodapeOrcamento(conteudo);
}

function initPreviewFlutuante() {
    const painel = UI.get('previewFlutuante');
    const btnToggle = UI.get('btnTogglePreview');
    const btnFechar = UI.get('btnFecharPreview');
    if (!painel || !btnToggle) return;

    btnToggle.addEventListener('click', () => {
        painel.classList.toggle('preview-flutuante--aberto');
        painel.classList.toggle('preview-flutuante--recolhido');
        if (painel.classList.contains('preview-flutuante--aberto')) {
            atualizarPreviewOrcamento();
        }
    });

    btnFechar?.addEventListener('click', () => {
        painel.classList.remove('preview-flutuante--aberto');
        painel.classList.add('preview-flutuante--recolhido');
    });
}
/* CEP */
const CEP_CONFIG = {
    orcEmpresaCep: {
        statusId:    'statusCepEmpresa',
        logradouro:  'orcEmpresaLogradouro',
        bairro:      'orcEmpresaBairro',
        localidade:  'orcEmpresaCidade',
        uf:          'orcEmpresaUf',
        legado:      'orcEmpresaEndereco'
    },
    orcClienteCep: {
        statusId:    'statusCepCliente',
        logradouro:  'orcClienteLogradouro',
        bairro:      'orcClienteBairro',
        localidade:  'orcClienteCidade',
        uf:          'orcClienteUf',
        legado:      'orcClienteEndereco'
    }
};

const cepRequests = new Map();

function mascaraCEP(v) {
    v = v.replace(/\D/g, '').substring(0, 8);
    return v.length > 5 ? v.replace(/^(\d{5})(\d)/, '$1-$2') : v;
}

function setCepStatus(statusId, tipo, msg) {
    const el = document.getElementById(statusId);
    if (!el) return;
    el.className = `cep-status cep-status--${tipo}`;
    el.textContent = msg;
}

async function buscarCEP(cep, config) {
    const { statusId, logradouro, bairro, localidade, uf, legado } = config;
    const cepLimpo = cep.replace(/\D/g, '');

    if (cepLimpo.length !== 8) {
        setCepStatus(statusId, '', '');
        return;
    }

    const requestAnterior = cepRequests.get(statusId);
    if (requestAnterior) requestAnterior.abort();
    const controller = new AbortController();
    cepRequests.set(statusId, controller);

    setCepStatus(statusId, 'loading', '⟳ Buscando...');
    [logradouro, bairro, localidade, uf].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.disabled = true; el.classList.add('campo-cep-carregando'); }
    });

    try {
        const res = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`, { signal: controller.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const dados = await res.json();

        if (dados.erro) {
            setCepStatus(statusId, 'erro', '✗ CEP não encontrado');
            [logradouro, bairro, localidade, uf].forEach(id => {
                const el = document.getElementById(id);
                if (el) { el.disabled = false; el.classList.remove('campo-cep-carregando'); }
            });
            return;
        }
        const mapa = { [logradouro]: dados.logradouro, [bairro]: dados.bairro, [localidade]: dados.localidade, [uf]: dados.uf };
        Object.entries(mapa).forEach(([id, valor]) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = valor || '';
                el.disabled = false;
                el.classList.remove('campo-cep-carregando');
                if (valor) { el.classList.add('campo-cep-ok'); setTimeout(() => el.classList.remove('campo-cep-ok'), 2000); }
            }
        });
        const elLegado = document.getElementById(legado);
        if (elLegado) elLegado.value = dados.logradouro || '';

        setCepStatus(statusId, 'ok', '✓ ' + dados.localidade + ' — ' + dados.uf);

    } catch (erro) {
        if (erro?.name === 'AbortError') return;
        setCepStatus(statusId, 'erro', '✗ Falha na busca');
        [logradouro, bairro, localidade, uf].forEach(id => {
            const el = document.getElementById(id);
            if (el) { el.disabled = false; el.classList.remove('campo-cep-carregando'); }
        });
    } finally {
        if (cepRequests.get(statusId) === controller) cepRequests.delete(statusId);
    }
}

function initCEP() {
    Object.entries(CEP_CONFIG).forEach(([cepId, config]) => {
        const input = document.getElementById(cepId);
        if (!input) return;

        // Aplica máscara e dispara busca
        input.addEventListener('input', () => {
            input.value = mascaraCEP(input.value);
            const cepLimpo = input.value.replace(/\D/g, '');
            if (cepLimpo.length === 8) {
                buscarCEP(input.value, config);
            } else {
                setCepStatus(config.statusId, '', '');
            }
        });

        // Busca ao colar (paste) ou ao sair do campo com 8 dígitos
        input.addEventListener('blur', () => {
            const cepLimpo = input.value.replace(/\D/g, '');
            if (cepLimpo.length === 8) buscarCEP(input.value, config);
        });
    });
}

/* Inicialização */
/* Clientes recentes */
const AC_KEY = 'korax_ac_clientes_v1';

function acCarregarLista() {
    try { return JSON.parse(localStorage.getItem(AC_KEY) || '[]'); }
    catch { return []; }
}

function acSalvarNome(nome) {
    if (!nome || !nome.trim()) return;
    const lista = acCarregarLista().filter(n => n.toLowerCase() !== nome.trim().toLowerCase());
    lista.unshift(nome.trim());
    localStorage.setItem(AC_KEY, JSON.stringify(lista.slice(0, 50)));
}

function acInit() {
    const input = document.getElementById('orcCliente');
    const lista = document.getElementById('ac_orcCliente');
    if (!input || !lista) return;

    function mostrar(termo) {
        const all = acCarregarLista();
        const filtrado = termo
            ? all.filter(n => n.toLowerCase().includes(termo.toLowerCase()))
            : all;
        if (!filtrado.length) { lista.style.display = 'none'; return; }
        lista.innerHTML = filtrado.slice(0, 8).map(n =>
            `<li data-val="${escaparHTML(n)}">${escaparHTML(n)}</li>`
        ).join('');
        lista.style.display = 'block';
    }

    input.addEventListener('focus', () => mostrar(input.value));
    input.addEventListener('input', () => mostrar(input.value));
    lista.addEventListener('mousedown', e => {
        const li = e.target.closest('li');
        if (!li) return;
        e.preventDefault();
        input.value = li.dataset.val;
        lista.style.display = 'none';
    });
    document.addEventListener('click', e => {
        if (!input.contains(e.target) && !lista.contains(e.target)) {
            lista.style.display = 'none';
        }
    });
}

let focoAntesDoModal = null;

function abrirModalAvisoLegal() {
    const modal = UI.get('modalAvisoLegal');
    const checkbox = UI.get('chkAvisoLegal');
    const confirmar = UI.get('btnConfirmarAvisoLegal');
    if (!modal || !checkbox || !confirmar) {
        calcular();
        return;
    }

    focoAntesDoModal = document.activeElement;
    checkbox.checked = false;
    confirmar.disabled = true;
    modal.classList.add('modal-aviso-overlay--ativo');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => checkbox.focus(), 0);
}

function fecharModalAvisoLegal() {
    const modal = UI.get('modalAvisoLegal');
    if (!modal) return;
    modal.classList.remove('modal-aviso-overlay--ativo');
    modal.setAttribute('aria-hidden', 'true');
    if (focoAntesDoModal && typeof focoAntesDoModal.focus === 'function') focoAntesDoModal.focus();
    focoAntesDoModal = null;
}

function solicitarConfirmacaoCalculo() {
    if (avisoLegalConfirmado) {
        calcular();
        return;
    }

    abrirModalAvisoLegal();
}

function initAvisoLegalCalculo() {
    const checkbox = UI.get('chkAvisoLegal');
    const confirmar = UI.get('btnConfirmarAvisoLegal');
    const cancelar = UI.get('btnCancelarAvisoLegal');

    checkbox?.addEventListener('change', () => {
        if (confirmar) confirmar.disabled = !checkbox.checked;
    });

    cancelar?.addEventListener('click', fecharModalAvisoLegal);

    confirmar?.addEventListener('click', () => {
        if (!checkbox?.checked) return;
        avisoLegalConfirmado = true;
        fecharModalAvisoLegal();
        calcular();
    });

    UI.get('modalAvisoLegal')?.addEventListener('keydown', event => {
        const modal = UI.get('modalAvisoLegal');
        if (!modal?.classList.contains('modal-aviso-overlay--ativo')) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            fecharModalAvisoLegal();
            return;
        }
        if (event.key !== 'Tab') return;
        const focaveis = Array.from(modal.querySelectorAll(
            'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )).filter(el => !el.hidden && el.offsetParent !== null);
        if (focaveis.length === 0) return;
        const primeiro = focaveis[0];
        const ultimo = focaveis[focaveis.length - 1];
        if (event.shiftKey && document.activeElement === primeiro) {
            event.preventDefault();
            ultimo.focus();
        } else if (!event.shiftKey && document.activeElement === ultimo) {
            event.preventDefault();
            primeiro.focus();
        }
    });
}

function associarLabelsAosCampos() {
    document.querySelectorAll('label:not([for])').forEach(label => {
        if (label.querySelector('input, select, textarea')) return;
        const campo = label.parentElement?.querySelector('input[id], select[id], textarea[id]');
        if (campo) label.htmlFor = campo.id;
    });
}

function initAcoesTela() {
    UI.get('btnAddMangueira')?.addEventListener('click', adicionarLinhaMangueira);
    UI.get('btnAddTerminal')?.addEventListener('click', adicionarLinhaTerminal);
    UI.get('btnSalvarKit')?.addEventListener('click', salvarKit);
    UI.get('btnCancelarEdicaoKit')?.addEventListener('click', cancelarEdicaoKit);
    UI.get('btnCalcular')?.addEventListener('click', solicitarConfirmacaoCalculo);
    UI.get('btnGerarPdfFlutuante')?.addEventListener('click', gerarPdf);

    document.addEventListener('click', event => {
        const alvo = event.target.closest('button');
        if (!alvo) return;

        const mangueiraId = alvo.dataset.removeMangueira;
        if (mangueiraId) {
            removerLinhaMangueira(mangueiraId);
            return;
        }

        const terminalId = alvo.dataset.removeTerminal;
        if (terminalId) {
            removerLinhaTerminal(terminalId);
            return;
        }

        const terminalQtyId = alvo.dataset.terminalQty;
        if (terminalQtyId) {
            alterarQtdTerminalExtra(terminalQtyId, Number(alvo.dataset.delta || 0));
            return;
        }

        const kitQtyId = alvo.dataset.kitQty;
        if (kitQtyId) {
            alterarQuantidadeKit(kitQtyId, Number(alvo.dataset.delta || 0));
            return;
        }

        const kitAction = alvo.dataset.kitAction;
        const kitId = alvo.dataset.kitId;
        if (!kitAction || !kitId) return;

        if (kitAction === 'editar') editarKit(kitId);
        if (kitAction === 'duplicar') duplicarKit(kitId);
        if (kitAction === 'excluir') excluirKit(kitId);
    });

    document.addEventListener('input', event => {
        const terminalId = event.target.dataset?.terminalInput;
        if (terminalId) setQtdTerminalExtra(terminalId, event.target.value);

        const kitId = event.target.dataset?.kitInput;
        if (kitId) setQuantidadeKit(kitId, event.target.value);

        const ipiItemId = event.target.dataset?.ipiItem;
        if (ipiItemId) {
            const isMangueira = ipiItemId.startsWith('mangueira');
            atualizarResumoIpiItem(ipiItemId, isMangueira);
            autoCalcular();
        }
    });
}

/* Inicialização */
document.addEventListener('DOMContentLoaded', async () => {
    associarLabelsAosCampos();
    initAcoesTela();
    initAvisoLegalCalculo();
    initMemoriaOrcamento();
    initTerminaisFixos();
    sincronizarEstadoControles();
    initCEP();
    initPreviewFlutuante();
    acInit();
    renderizarKits();
    await carregarDados();
});
