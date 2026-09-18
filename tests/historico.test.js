const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SimuladorLogic = require('../logic.js');
const OrcamentoStorage = require('../storage.js');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function criarContexto(opcoes = {}) {
    const armazenamento = new Map();
    const confirmacoes = [];
    const controles = {
        orcNumero: { id: 'orcNumero', value: '2026-001' },
        orcCliente: { id: 'orcCliente', value: 'Cliente Local' },
        orcData: { id: 'orcData', value: '2026-09-14' },
        faturamento: { id: 'faturamento', value: 'sc12', addEventListener() {} },
        prensagem: { id: 'prensagem', value: '10,00', addEventListener() {} },
        embalagem: { id: 'embalagem', value: '5,00', addEventListener() {} },
        desconto: { id: 'desconto', value: '10', addEventListener() {}, classList: { add() {}, remove() {} } },
        resultado: { id: 'resultado', value: '', innerHTML: '', dataset: {} },
        terminalA: { id: 'terminalA', value: 'na', options: [{ text: 'Terminal T1' }], selectedIndex: 0 },
        terminalB: { id: 'terminalB', value: 'na', options: [{ text: 'Nenhum' }], selectedIndex: 0 },
        valorTerminalA: { id: 'valorTerminalA', value: '' },
        valorTerminalB: { id: 'valorTerminalB', value: '' },
        ipi_terminalA: { id: 'ipi_terminalA', value: '0' },
        ipi_terminalB: { id: 'ipi_terminalB', value: '0' },
        nomeKit: { id: 'nomeKit', value: '' },
        btnSalvarKit: { id: 'btnSalvarKit', innerHTML: '' },
        btnCancelarEdicaoKit: { id: 'btnCancelarEdicaoKit', hidden: true }
    };
    const camposOrcamento = [controles.orcNumero, controles.orcCliente, controles.orcData];
    const document = {
        body: {},
        getElementById: id => controles[id] || null,
        querySelectorAll: seletor => seletor === 'input[id^="orc"], select[id^="orc"]' ? camposOrcamento : [],
        querySelector: () => null,
        addEventListener() {}
    };
    const localStorage = {
        getItem: chave => armazenamento.has(chave) ? armazenamento.get(chave) : null,
        setItem: (chave, valor) => armazenamento.set(chave, String(valor))
    };
    const context = vm.createContext({
        SimuladorLogic, OrcamentoStorage, document, controles, localStorage,
        setTimeout: callback => callback(),
        alert() {}, confirm(mensagem) {
            confirmacoes.push(mensagem);
            return opcoes.confirmar !== false;
        }
    });
    vm.runInContext(script, context);
    return { context, controles, armazenamento, confirmacoes };
}

const kitSalvo = {
    id: 'kit_local', nome: 'Kit histórico', quantidade: 2, faturamento: 'sc12',
    mangueiras: [{ value: 'M1', texto: 'Mangueira', mm: 1000, ipi: 5 }],
    conjunto1: 'T1', conjunto1Texto: 'Terminal A', conjunto1Ipi: 5,
    conjunto2: 'T2', conjunto2Texto: 'Terminal B', conjunto2Ipi: 5,
    terminaisExtras: [], subtotal: 110, ipiTotal: 10, descontoValor: 0, total: 110
};

test('snapshot local inclui identificação, kits, custos, desconto e preços originais', () => {
    const { context } = criarContexto();
    context.kitTeste = kitSalvo;
    const snapshot = vm.runInContext("kits = [kitTeste]; orcamentosSalvos = []; criarSnapshotOrcamento('orc_local')", context);
    assert.equal(snapshot.campos.orcNumero, '2026-001');
    assert.equal(snapshot.campos.orcCliente, 'Cliente Local');
    assert.equal(snapshot.faturamento, 'sc12');
    assert.equal(snapshot.kits[0].total, 110);
    assert.equal(snapshot.kits[0].ipiTotal, 10);
    assert.deepEqual(snapshot.custos, { prensagem: '10,00', embalagem: '5,00', desconto: '10' });
    assert.equal(snapshot.totalFinal, 211.5);
});

test('abrir orçamento restaura os campos e calcular não troca os preços históricos', () => {
    const { context, controles } = criarContexto();
    context.registro = OrcamentoStorage.normalizarOrcamento({
        id: 'orc_salvo',
        campos: { orcNumero: 'ANTIGO-9', orcCliente: 'Cliente Reaberto', orcData: '2026-08-20' },
        faturamento: 'sc12', kits: [kitSalvo],
        custos: { prensagem: '0,00', embalagem: '0,00', desconto: '0' }, totalFinal: 220
    });
    vm.runInContext("orcamentosSalvos = [registro]; abrirOrcamentoLocal('orc_salvo'); calcular();", context);
    assert.equal(controles.orcNumero.value, 'ANTIGO-9');
    assert.equal(controles.orcCliente.value, 'Cliente Reaberto');
    assert.equal(controles.faturamento.value, 'sc12');
    assert.match(controles.resultado.innerHTML, /R\$\s*220,00/);
    assert.equal(vm.runInContext('kits[0].total', context), 110);
});

test('abrir outro orçamento exige confirmação quando há alterações não salvas', () => {
    const { context, controles, confirmacoes } = criarContexto({ confirmar: false });
    context.registro = OrcamentoStorage.normalizarOrcamento({
        id: 'orc_salvo', campos: { orcNumero: 'ANTIGO-9', orcCliente: 'Outro cliente' }, kits: [kitSalvo]
    });
    vm.runInContext("orcamentosSalvos = [registro]; abrirOrcamentoLocal('orc_salvo')", context);
    assert.equal(controles.orcNumero.value, '2026-001');
    assert.equal(confirmacoes.length, 1);
});

test('orçamento salvo só pede confirmação após uma alteração real', () => {
    const { context, controles } = criarContexto();
    context.kitTeste = kitSalvo;
    assert.equal(vm.runInContext('kits = [kitTeste]; salvarOrcamentoLocal(); haAlteracoesNaoSalvas()', context), false);
    controles.orcCliente.value = 'Cliente alterado';
    assert.equal(vm.runInContext('haAlteracoesNaoSalvas()', context), true);
});

test('rascunho de kit e kit em edição contam como alterações não salvas', () => {
    const { context, controles } = criarContexto();
    context.kitTeste = kitSalvo;
    assert.equal(vm.runInContext('kits = [kitTeste]; salvarOrcamentoLocal(); haAlteracoesNaoSalvas()', context), false);
    controles.nomeKit.value = 'Kit ainda não salvo';
    assert.equal(vm.runInContext('haAlteracoesNaoSalvas()', context), true);
    controles.nomeKit.value = '';
    vm.runInContext("kitEmEdicaoId = 'kit_local'", context);
    assert.equal(vm.runInContext('haAlteracoesNaoSalvas()', context), true);
});

test('editar kit novo conserva preço unitário salvo apesar de catálogo diferente', () => {
    const { context, controles } = criarContexto();
    context.kitTeste = {
        id: 'kit_precos', nome: 'Kit com preço histórico', quantidade: 1, faturamento: 'sc12',
        mangueiras: [], conjunto1: 'T1', conjunto1Texto: 'Terminal T1', conjunto1Ipi: 0,
        conjunto1Preco: 10, conjunto2: 'na', conjunto2Texto: 'Nenhum', conjunto2Ipi: 0,
        terminaisExtras: [], subtotal: 10, ipiTotal: 0, total: 10
    };
    vm.runInContext(`
        kits = [kitTeste]; state.catalogo = 'ready';
        dados = { mangueiras: [], terminais: [{ codigo: 'T1', descricao: 'Terminal T1', sc12: 20 }] };
        editarKit('kit_precos');
    `, context);
    assert.equal(controles.valorTerminalA.value, '10,00');
    vm.runInContext('salvarKit()', context);
    assert.equal(vm.runInContext('kits[0].total', context), 10);
    assert.equal(vm.runInContext('kits[0].conjunto1Preco', context), 10);
});

test('falha de armazenamento não adiciona registro em memória nem libera impressão', async () => {
    const { context, armazenamento, controles } = criarContexto();
    controles.orcCliente.value = '';
    context.kitTeste = kitSalvo;
    vm.runInContext(`
        kits = [kitTeste];
        localStorage.setItem = () => { throw new Error('quota'); };
        let impressaoSolicitada = false;
        prepararOrcamentoParaPdf = () => ({ querySelector() { return null; } });
        window = { print() { impressaoSolicitada = true; } };
    `, context);
    await vm.runInContext('gerarPdf()', context);
    assert.equal(vm.runInContext('impressaoSolicitada', context), false);
    assert.equal(vm.runInContext('orcamentosSalvos.length', context), 0);
    assert.equal(armazenamento.has('korax_orcamentos_v1'), false);
});

test('kit com preço histórico é distinguido de registro antigo e item sem preço atual bloqueia atualização', () => {
    const { context } = criarContexto();
    context.kitTeste = kitSalvo;
    vm.runInContext(`
        dados = { mangueiras: [], terminais: [] };
    `, context);
    assert.equal(vm.runInContext('kitTemPrecosHistoricos(kitTeste)', context), false);
    assert.deepEqual([...vm.runInContext("itensSemPrecoAtual(kitTeste, 'sc12')", context)], ['M1', 'T1', 'T2']);
    context.kitComPrecos = {
        ...kitSalvo,
        mangueiras: [{ ...kitSalvo.mangueiras[0], precoMetro: 10 }],
        conjunto1Preco: 20,
        conjunto2Preco: 30
    };
    assert.equal(vm.runInContext('kitTemPrecosHistoricos(kitComPrecos)', context), true);
});

test('atualização de preços não zera kits quando um produto saiu do catálogo', () => {
    const { context, confirmacoes } = criarContexto();
    context.kitTeste = kitSalvo;
    vm.runInContext(`
        kits = [kitTeste];
        state.catalogo = 'ready';
        dados = { mangueiras: [], terminais: [] };
        atualizarPrecosDoOrcamento();
    `, context);
    assert.equal(vm.runInContext('kits[0].total', context), 110);
    assert.equal(confirmacoes.length, 0);
});

test('limite do histórico recusa novo registro sem excluir os cem existentes', () => {
    const { context, armazenamento } = criarContexto();
    context.kitTeste = kitSalvo;
    context.registrosTeste = Array.from({ length: 100 }, (_, indice) =>
        OrcamentoStorage.normalizarOrcamento({ id: `orc_${indice}`, kits: [kitSalvo] }));
    const resultado = vm.runInContext('orcamentosSalvos = registrosTeste; kits = [kitTeste]; salvarOrcamentoLocal()', context);
    assert.equal(resultado, false);
    assert.equal(vm.runInContext('orcamentosSalvos.length', context), 100);
    assert.equal(armazenamento.has('korax_orcamentos_v1'), false);
});

test('salvamento automático registra uma cópia local editável', () => {
    const { context, armazenamento } = criarContexto();
    context.kitTeste = kitSalvo;
    const salvo = vm.runInContext("kits = [kitTeste]; salvarOrcamentoLocal({ automatico: true })", context);
    const [registro] = JSON.parse(armazenamento.get('korax_orcamentos_v1'));
    assert.equal(salvo, true);
    assert.equal(registro.campos.orcNumero, '2026-001');
    assert.equal(registro.kits[0].total, 110);
});

test('gerar PDF solicita o salvamento automático antes da impressão', async () => {
    const { context, controles } = criarContexto();
    controles.orcCliente.value = '';
    context.kitTeste = kitSalvo;
    vm.runInContext(`
        kits = [kitTeste];
        let salvamentoAutomaticoRecebido = false;
        let impressaoSolicitada = false;
        salvarOrcamentoLocal = opcoes => { salvamentoAutomaticoRecebido = opcoes?.automatico === true; return true; };
        prepararOrcamentoParaPdf = () => ({ querySelector() { return null; } });
        ajustarRodapeOrcamento = () => {};
        window = { print() { impressaoSolicitada = true; } };
    `, context);
    await vm.runInContext('gerarPdf()', context);
    assert.equal(vm.runInContext('salvamentoAutomaticoRecebido', context), true);
    assert.equal(vm.runInContext('impressaoSolicitada', context), true);
});
