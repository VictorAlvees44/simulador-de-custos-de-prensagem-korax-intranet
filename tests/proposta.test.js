const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const SimuladorLogic = require('../logic.js');

const script = fs.readFileSync(path.join(__dirname, '..', 'script.js'), 'utf8');
const kit = {
    nome: 'Kit de teste', quantidade: 2, total: 110, ipiTotal: 10,
    mangueiras: [{ texto: 'Mangueira M1', mm: 1500, ipi: 7 }],
    conjunto1Texto: 'Terminal A1', conjunto1Ipi: 10,
    conjunto2Texto: 'Terminal B1', conjunto2Ipi: 5,
    terminaisExtras: [{ value: 'E1', texto: 'Terminal E1', qty: 3, ipi: 8 }]
};

function montarProposta(campos = {}) {
    const context = vm.createContext({
        SimuladorLogic,
        kitsTeste: [kit],
        document: {
            body: {},
            getElementById: id => id in campos ? { value: campos[id], addEventListener() {} } : null,
            querySelectorAll: () => [],
            addEventListener() {}
        }
    });
    vm.runInContext(script, context);
    return vm.runInContext('kits = kitsTeste; montarHtmlOrcamento();', context);
}

test('PDF não inclui IPI nem porcentagens nas descrições de nenhum componente', () => {
    const html = montarProposta({ desconto: '10' });
    const descricoes = [...html.matchAll(/<span class="pdf-kit-detalhe">(.*?)<\/span>/g)].map(match => match[1]);
    assert.equal(descricoes.length, 4);
    assert.match(descricoes.join(' '), /1500 mm/);
    assert.match(descricoes.join(' '), /Terminal E1 ×3/);
    assert.doesNotMatch(descricoes.join(' '), /IPI|%/i);
    assert.doesNotMatch(html, /DESCONTO|%|SUBTOTAL/i);
});

test('PDF exibe coluna de IPI e totais líquidos na ordem produtos, IPI e final', () => {
    const html = montarProposta({ desconto: '10', prensagem: '10,00', embalagem: '5,00' });
    assert.match(html, /<th class="col-ipi">VALOR DO IPI<\/th>/);
    assert.match(html, /<td class="col-vtotal">R\$\s*180,00<\/td>/);
    assert.match(html, /<td class="col-ipi">R\$\s*18,00<\/td>/);
    const labels = [...html.matchAll(/<td class="tot-label">(.*?)<\/td>/g)].map(match => match[1]);
    assert.deepEqual(labels, ['TOTAL DOS PRODUTOS (SEM IPI)', 'TOTAL DO IPI', 'PRENSAGEM E EMBALAGEM', 'VALOR FINAL']);
    const valores = [...html.matchAll(/<td class="tot-valor">(.*?)<\/td>/g)].map(match => SimuladorLogic.numeroDeMoeda(match[1]));
    assert.deepEqual(valores, [180, 18, 13.5, 211.5]);
});

test('PDF omite custos adicionais zerados sem ocultar o total do IPI', () => {
    const html = montarProposta();
    assert.doesNotMatch(html, /PRENSAGEM E EMBALAGEM/);
    assert.match(html, /TOTAL DO IPI/);
});
