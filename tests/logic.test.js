const test = require('node:test');
const assert = require('node:assert/strict');
const {
    numeroDeMoeda,
    calcularTotal,
    erroValidacaoKit
} = require('../logic.js');

test('interpreta valores brasileiros e decimais da API', () => {
    assert.equal(numeroDeMoeda('R$ 1.234,56'), 1234.56);
    assert.equal(numeroDeMoeda('6,948'), 6.948);
    assert.equal(numeroDeMoeda('6.948'), 6.948);
    assert.equal(numeroDeMoeda('inválido'), 0);
});

test('aplica imposto somente aos produtos e limita desconto', () => {
    const total = calcularTotal({
        mangueiras: 100,
        terminais: [20, 30],
        prensagem: 10,
        embalagem: 5,
        imposto: 10,
        desconto: 30
    });
    assert.equal(total.produtos, 150);
    assert.equal(total.imposto, 15);
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
