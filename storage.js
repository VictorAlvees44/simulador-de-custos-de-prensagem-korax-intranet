(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.OrcamentoStorage = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const TIPO_BACKUP = 'korax-orcamentos';
    const VERSAO = 1;
    const LIMITE_ORCAMENTOS = 100;
    const FATURAMENTOS = new Set(['sp18', 'sc12', 'sp4', 'sc4']);

    function texto(valor, limite = 5000) {
        return String(valor ?? '').slice(0, limite);
    }

    function numero(valor, minimo = 0, maximo = Number.MAX_SAFE_INTEGER) {
        const convertido = Number(valor);
        return Number.isFinite(convertido) ? Math.max(minimo, Math.min(convertido, maximo)) : minimo;
    }

    function idSeguro(valor, prefixo) {
        const atual = texto(valor, 100);
        if (/^[a-zA-Z0-9_-]+$/.test(atual)) return atual;
        return `${prefixo}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    function normalizarKit(kit = {}, indice = 0) {
        return {
            id: idSeguro(kit.id, `kit${indice + 1}`),
            nome: texto(kit.nome, 300).trim(),
            quantidade: Math.max(1, Math.round(numero(kit.quantidade, 1, 999999))),
            faturamento: FATURAMENTOS.has(kit.faturamento) ? kit.faturamento : '',
            mangueiras: (Array.isArray(kit.mangueiras) ? kit.mangueiras : []).slice(0, 100).map(item => ({
                id: texto(item?.id, 100),
                value: texto(item?.value, 200),
                texto: texto(item?.texto, 1000),
                mm: numero(item?.mm, 0, 100000000),
                ipi: numero(item?.ipi, 0, 100)
            })),
            conjunto1: texto(kit.conjunto1, 200),
            conjunto1Texto: texto(kit.conjunto1Texto, 1000),
            conjunto1Ipi: numero(kit.conjunto1Ipi, 0, 100),
            conjunto2: texto(kit.conjunto2, 200),
            conjunto2Texto: texto(kit.conjunto2Texto, 1000),
            conjunto2Ipi: numero(kit.conjunto2Ipi, 0, 100),
            terminaisExtras: (Array.isArray(kit.terminaisExtras) ? kit.terminaisExtras : []).slice(0, 100).map(item => ({
                id: texto(item?.id, 100),
                value: texto(item?.value, 200),
                texto: texto(item?.texto, 1000),
                qty: Math.max(1, Math.round(numero(item?.qty, 1, 999999))),
                ipi: numero(item?.ipi, 0, 100)
            })),
            subtotal: numero(kit.subtotal),
            ipiTotal: numero(kit.ipiTotal),
            descontoValor: numero(kit.descontoValor),
            total: numero(kit.total)
        };
    }

    function dataIso(valor, fallback) {
        const data = new Date(valor);
        return Number.isNaN(data.getTime()) ? fallback : data.toISOString();
    }

    function normalizarOrcamento(item = {}, indice = 0) {
        const agora = new Date().toISOString();
        const campos = {};
        if (item.campos && typeof item.campos === 'object' && !Array.isArray(item.campos)) {
            Object.entries(item.campos).forEach(([chave, valor]) => {
                if (/^orc[A-Za-z0-9_]+$/.test(chave)) campos[chave] = texto(valor);
            });
        }
        const criadoEm = dataIso(item.criadoEm, agora);
        return {
            id: idSeguro(item.id, `orc${indice + 1}`),
            versao: VERSAO,
            criadoEm,
            atualizadoEm: dataIso(item.atualizadoEm, criadoEm),
            campos,
            faturamento: FATURAMENTOS.has(item.faturamento) ? item.faturamento : '',
            kits: (Array.isArray(item.kits) ? item.kits : []).slice(0, 100).map(normalizarKit),
            custos: {
                prensagem: texto(item.custos?.prensagem, 100),
                embalagem: texto(item.custos?.embalagem, 100),
                desconto: texto(item.custos?.desconto, 100)
            },
            totalFinal: numero(item.totalFinal)
        };
    }

    function normalizarLista(lista) {
        if (!Array.isArray(lista)) return [];
        const unicos = new Map();
        lista.slice(0, LIMITE_ORCAMENTOS * 2).forEach((item, indice) => {
            const orcamento = normalizarOrcamento(item, indice);
            const anterior = unicos.get(orcamento.id);
            if (!anterior || orcamento.atualizadoEm >= anterior.atualizadoEm) unicos.set(orcamento.id, orcamento);
        });
        return [...unicos.values()]
            .sort((a, b) => b.atualizadoEm.localeCompare(a.atualizadoEm))
            .slice(0, LIMITE_ORCAMENTOS);
    }

    function serializar(lista) {
        return JSON.stringify({
            tipo: TIPO_BACKUP,
            versao: VERSAO,
            exportadoEm: new Date().toISOString(),
            orcamentos: normalizarLista(lista)
        }, null, 2);
    }

    function desserializar(conteudo) {
        const payload = JSON.parse(String(conteudo || ''));
        const lista = Array.isArray(payload) ? payload : payload?.orcamentos;
        if (!Array.isArray(lista) || (!Array.isArray(payload) && payload.tipo !== TIPO_BACKUP)) {
            throw new Error('Arquivo de backup inválido.');
        }
        const normalizados = normalizarLista(lista);
        if (normalizados.length === 0) throw new Error('O arquivo não contém orçamentos válidos.');
        return normalizados;
    }

    function mesclarListas(atuais, importados) {
        return normalizarLista([...normalizarLista(atuais), ...normalizarLista(importados)]);
    }

    return { TIPO_BACKUP, VERSAO, LIMITE_ORCAMENTOS, normalizarOrcamento, normalizarLista, serializar, desserializar, mesclarListas };
});
