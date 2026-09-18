const test = require('node:test');
const assert = require('node:assert/strict');
const Storage = require('../storage.js');

function orcamento(overrides = {}) {
    return {
        id: 'orc_teste_1',
        criadoEm: '2026-09-01T10:00:00.000Z',
        atualizadoEm: '2026-09-01T11:00:00.000Z',
        campos: {
            orcNumero: '123',
            orcCliente: 'Cliente Teste',
            orcData: '2026-09-01'
        },
        faturamento: 'sc12',
        kits: [{
            id: 'kit_1', nome: 'Kit salvo', quantidade: 2, faturamento: 'sc12',
            mangueiras: [{ id: 'mangueira1', value: 'M1', texto: 'Mangueira M1', mm: 1500, ipi: 7 }],
            conjunto1: 'T1', conjunto1Texto: 'Terminal T1', conjunto1Ipi: 5,
            conjunto2: 'T2', conjunto2Texto: 'Terminal T2', conjunto2Ipi: 8,
            terminaisExtras: [{ id: 'extra1', value: 'E1', texto: 'Extra E1', qty: 3, ipi: 4 }],
            subtotal: 110, ipiTotal: 10, descontoValor: 0, total: 110
        }],
        custos: { prensagem: '10,00', embalagem: '5,00', desconto: '10' },
        totalFinal: 211.5,
        ...overrides
    };
}

test('backup preserva dados, preços e IPIs do orçamento original', () => {
    const json = Storage.serializar([orcamento()]);
    const [restaurado] = Storage.desserializar(json);
    assert.equal(restaurado.campos.orcCliente, 'Cliente Teste');
    assert.equal(restaurado.kits[0].total, 110);
    assert.equal(restaurado.kits[0].ipiTotal, 10);
    assert.equal(restaurado.kits[0].mangueiras[0].ipi, 7);
    assert.equal(restaurado.kits[0].terminaisExtras[0].qty, 3);
    assert.deepEqual(restaurado.custos, { prensagem: '10,00', embalagem: '5,00', desconto: '10' });
    assert.equal(restaurado.totalFinal, 211.5);
});

test('mescla backup mantendo a versão mais recente de cada orçamento', () => {
    const antigo = orcamento({ atualizadoEm: '2026-09-01T11:00:00.000Z', totalFinal: 100 });
    const novo = orcamento({ atualizadoEm: '2026-09-02T11:00:00.000Z', totalFinal: 200 });
    const mesclados = Storage.mesclarListas([antigo], [novo]);
    assert.equal(mesclados.length, 1);
    assert.equal(mesclados[0].totalFinal, 200);
});

test('importação rejeita arquivo alheio e normaliza valores inseguros', () => {
    assert.throws(() => Storage.desserializar('{"tipo":"outro","orcamentos":[]}'), /inválido/);
    const normalizado = Storage.normalizarOrcamento(orcamento({
        id: 'id com espaços e aspas"',
        faturamento: 'desconhecido',
        campos: { orcCliente: 'Cliente', campoInesperado: 'ignorar' },
        kits: [{ id: 'kit inválido"', quantidade: -5, conjunto1Ipi: 800, total: -10 }]
    }));
    assert.match(normalizado.id, /^[a-zA-Z0-9_-]+$/);
    assert.equal(normalizado.faturamento, '');
    assert.deepEqual(normalizado.campos, { orcCliente: 'Cliente' });
    assert.equal(normalizado.kits[0].quantidade, 1);
    assert.equal(normalizado.kits[0].conjunto1Ipi, 100);
    assert.equal(normalizado.kits[0].total, 0);
});

test('histórico não apaga silenciosamente o orçamento mais antigo ao passar de 100', () => {
    const lista = Array.from({ length: 101 }, (_, indice) => orcamento({
        id: `orc_${indice}`,
        atualizadoEm: new Date(2026, 8, 1, 0, indice).toISOString()
    }));
    const normalizados = Storage.normalizarLista(lista);
    assert.equal(normalizados.length, 101);
    assert.ok(normalizados.some(item => item.id === 'orc_0'));
});

test('backup preserva preços unitários e distingue registros antigos sem preço por componente', () => {
    const original = orcamento();
    original.kits[0].mangueiras[0].precoMetro = 6.94;
    original.kits[0].conjunto1Preco = 12.5;
    original.kits[0].conjunto2Preco = 8.2;
    original.kits[0].terminaisExtras[0].precoUnitario = 3.15;
    const [restaurado] = Storage.desserializar(Storage.serializar([original]));
    assert.equal(restaurado.kits[0].mangueiras[0].precoMetro, 6.94);
    assert.equal(restaurado.kits[0].conjunto1Preco, 12.5);
    assert.equal(restaurado.kits[0].conjunto2Preco, 8.2);
    assert.equal(restaurado.kits[0].terminaisExtras[0].precoUnitario, 3.15);
    assert.equal(Storage.normalizarOrcamento(orcamento()).kits[0].conjunto1Preco, null);
});
