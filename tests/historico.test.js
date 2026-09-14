const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SimuladorLogic = require('../logic.js');
const OrcamentoStorage = require('../storage.js');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');

function criarContexto() {
    const controles = {
        orcNumero: { id: 'orcNumero', value: '2026-001' },
        orcCliente: { id: 'orcCliente', value: 'Cliente Local' },
        orcData: { id: 'orcData', value: '2026-09-14' },
        faturamento: { id: 'faturamento', value: 'sc12', addEventListener() {} },
        prensagem: { id: 'prensagem', value: '10,00', addEventListener() {} },
        embalagem: { id: 'embalagem', value: '5,00', addEventListener() {} },
        desconto: { id: 'desconto', value: '10', addEventListener() {}, classList: { add() {}, remove() {} } },
        resultado: { id: 'resultado', value: '', innerHTML: '', dataset: {} }
    };
    const camposOrcamento = [controles.orcNumero, controles.orcCliente, controles.orcData];
    const document = {
        body: {},
        getElementById: id => controles[id] || null,
        querySelectorAll: seletor => seletor === 'input[id^="orc"], select[id^="orc"]' ? camposOrcamento : [],
        querySelector: () => null,
        addEventListener() {}
    };
    const context = vm.createContext({ SimuladorLogic, OrcamentoStorage, document, controles });
    vm.runInContext(script, context);
    return { context, controles };
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
