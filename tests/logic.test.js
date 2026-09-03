const test = require('node:test');
const assert = require('node:assert/strict');
const {
    numeroDeMoeda,
    calcularItemComIpi,
    calcularTotal,
    calcularValoresProposta,
    erroValidacaoKit
} = require('../logic.js');

test('interpreta valores brasileiros e decimais da API', () => {
    assert.equal(numeroDeMoeda('R$ 1.234,56'), 1234.56);
    assert.equal(numeroDeMoeda('6,948'), 6.948);
    assert.equal(numeroDeMoeda('6.948'), 6.948);
    assert.equal(numeroDeMoeda('inválido'), 0);
});

test('calcula o IPI individual de um produto', () => {
    assert.deepEqual(calcularItemComIpi(150, 10), {
        base: 150,
        percentual: 10,
        ipi: 15,
        total: 165
    });
    assert.equal(calcularItemComIpi(100, 150).total, 200);
});

test('consolida produtos com IPI já aplicado e limita desconto', () => {
    const total = calcularTotal({
        mangueiras: 110,
        terminais: [22, 33],
        prensagem: 10,
        embalagem: 5,
        ipiTotal: 15,
        desconto: 30
    });
    assert.equal(total.produtos, 165);
    assert.equal(total.ipi, 15);
    assert.equal(total.subtotal, 180);
    assert.equal(total.desconto, 45);
    assert.equal(total.total, 135);
});

test('rejeita kit vazio mesmo quando os selects usam o valor na', () => {
    assert.equal(erroValidacaoKit({
        nome: 'Kit vazio',
        faturamento: 'sc12',
        mangueiras: [],
        conjunto1: 'na',
        conjunto2: 'na',
        terminaisExtras: []
    }), 'Selecione ao menos uma mangueira ou terminal.');
});

test('aceita kit que contenha um terminal válido', () => {
    assert.equal(erroValidacaoKit({
        nome: 'Kit terminal',
        faturamento: 'sc12',
        mangueiras: [],
        conjunto1: 'ABC',
        conjunto2: 'na',
        terminaisExtras: []
    }), '');
});

test('exige os dois terminais para kits com mangueira', () => {
    assert.equal(erroValidacaoKit({
        nome: 'Kit mangueira',
        faturamento: 'sc12',
        mangueiras: [{ value: 'M1', mm: 1000 }],
        conjunto1: 'T1',
        conjunto2: 'na',
        terminaisExtras: []
    }), 'Selecione o Terminal B.');
});

test('separa produtos e IPI líquidos do desconto sem cobrar IPI duas vezes', () => {
    const proposta = calcularValoresProposta([
        { total: 110, ipiTotal: 10, quantidade: 2 },
        { total: 70, ipiTotal: 20, quantidade: 1 }
    ], { descontoPercentual: 10, prensagem: 10, embalagem: 5 });
    assert.deepEqual(proposta.itens, [
        { quantidade: 2, vUnit: 90, vTotal: 180, vIpi: 18 },
        { quantidade: 1, vUnit: 45, vTotal: 45, vIpi: 18 }
    ]);
    assert.equal(proposta.totalProdutos, 225);
    assert.equal(proposta.totalIpi, 36);
    assert.equal(proposta.custosAdicionais, 13.5);
    assert.equal(proposta.totalFinal, 274.5);
});

test('concilia centavos entre linhas, produtos, IPI e valor final', () => {
    const proposta = calcularValoresProposta([
        { total: 9.97246, ipiTotal: 0.66446, quantidade: 1 },
        { total: 3.3333, ipiTotal: 0.1234, quantidade: 3 }
    ], { descontoPercentual: 12.5, embalagem: 0.01 });
    const centavos = valor => Math.round(valor * 100);
    assert.equal(proposta.itens.reduce((soma, item) => soma + centavos(item.vTotal), 0), centavos(proposta.totalProdutos));
    assert.equal(proposta.itens.reduce((soma, item) => soma + centavos(item.vIpi), 0), centavos(proposta.totalIpi));
    assert.equal(centavos(proposta.totalProdutos) + centavos(proposta.totalIpi) + centavos(proposta.custosAdicionais), centavos(proposta.totalFinal));
    assert.equal(centavos(proposta.totalFinal), Math.round((9.97246 + 3.3333 * 3 + 0.01) * 0.875 * 100));
});

test('proposta sem IPI mantém valor zero e trata kits antigos e lista vazia', () => {
    const proposta = calcularValoresProposta([{ total: 100, quantidade: 2 }]);
    assert.equal(proposta.totalProdutos, 200);
    assert.equal(proposta.totalIpi, 0);
    assert.equal(proposta.totalFinal, 200);
    assert.equal(calcularValoresProposta([]).totalFinal, 0);
});
