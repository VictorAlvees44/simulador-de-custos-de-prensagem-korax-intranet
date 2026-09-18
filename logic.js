(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.SimuladorLogic = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    function numeroDeMoeda(value) {
        let normalizado = String(value ?? '')
            .trim()
            .replace(/R\$/gi, '')
            .replace(/\s/g, '');
        normalizado = normalizado.includes(',')
            ? normalizado.replace(/\./g, '').replace(',', '.')
            : normalizado;
        const numero = Number(normalizado);
        return Number.isFinite(numero) ? numero : 0;
    }

    function calcularItemComIpi(valorBase, aliquota) {
        const base = Math.max(0, Number(valorBase) || 0);
        const percentual = Math.max(0, Math.min(Number(aliquota) || 0, 100));
        const ipi = base * (percentual / 100);
        return { base, percentual, ipi, total: base + ipi };
    }

    function calcularTotal(inputs = {}) {
        let produtos = Number(inputs.mangueiras) || 0;
        (inputs.terminais || []).forEach(valor => { produtos += Number(valor) || 0; });
        const ipi = Math.max(0, Number(inputs.ipiTotal) || 0);
        let subtotal = produtos;
        subtotal += Number(inputs.prensagem) || 0;
        subtotal += Number(inputs.embalagem) || 0;
        const percentual = Math.max(0, Math.min(Number(inputs.desconto) || 0, 25));
        const desconto = subtotal * (percentual / 100);
        return { produtos, ipi, subtotal, desconto, total: subtotal - desconto };
    }

    // Projeta os valores já calculados para a proposta do cliente. O desconto
    // permanece interno; produtos e IPI são separados, sem nova incidência.
    function calcularValoresProposta(kits = [], custos = {}) {
        const fator = 1 - Math.max(0, Math.min(Number(custos.descontoPercentual) || 0, 25)) / 100;
        const itens = kits.map(kit => {
            const quantidade = Math.max(1, Number(kit.quantidade) || 1);
            const ipiUnitario = Math.max(0, Number(kit.ipiTotal) || 0);
            const produtoUnitario = Math.max(0, (Number(kit.total) || 0) - ipiUnitario);
            return {
                quantidade,
                vUnit: produtoUnitario * fator,
                produtos: produtoUnitario * quantidade * fator,
                ipi: ipiUnitario * quantidade * fator
            };
        });
        const adicionais = ((Number(custos.prensagem) || 0) + (Number(custos.embalagem) || 0)) * fator;
        const valores = [...itens.flatMap(item => [item.produtos, item.ipi]), adicionais];
        const centavosExatos = valores.map(valor => Math.max(0, valor) * 100);
        const centavos = centavosExatos.map(Math.floor);
        const totalCentavos = Math.round(centavosExatos.reduce((soma, valor) => soma + valor, 0));
        const restante = totalCentavos - centavos.reduce((soma, valor) => soma + valor, 0);
        // Distribui eventuais centavos de arredondamento pelas maiores frações.
        // Dessa forma as linhas, os subtotais e o total final sempre fecham.
        const ordem = centavosExatos.map((valor, indice) => ({ indice, fracao: valor - centavos[indice] }))
            .sort((a, b) => b.fracao - a.fracao || a.indice - b.indice);
        for (let i = 0; i < restante; i++) centavos[ordem[i].indice]++;
        const linhas = itens.map((item, indice) => ({
            quantidade: item.quantidade,
            vUnit: centavos[indice * 2] / 100 / item.quantidade,
            vTotal: centavos[indice * 2] / 100,
            vIpi: centavos[indice * 2 + 1] / 100
        }));
        return {
            itens: linhas,
            totalProdutos: centavos.reduce((soma, valor, indice) =>
                indice < itens.length * 2 && indice % 2 === 0 ? soma + valor : soma, 0) / 100,
            totalIpi: centavos.reduce((soma, valor, indice) =>
                indice < itens.length * 2 && indice % 2 === 1 ? soma + valor : soma, 0) / 100,
            custosAdicionais: centavos[centavos.length - 1] / 100,
            totalFinal: totalCentavos / 100
        };
    }

    function componenteSelecionado(value) {
        return Boolean(value && value !== 'na');
    }

    function erroValidacaoKit(kit = {}) {
        const mangueiras = Array.isArray(kit.mangueiras) ? kit.mangueiras : [];
        const extras = Array.isArray(kit.terminaisExtras) ? kit.terminaisExtras : [];
        const temTerminal = componenteSelecionado(kit.conjunto1)
            || componenteSelecionado(kit.conjunto2)
            || extras.some(item => componenteSelecionado(item?.value));

        if (!String(kit.nome || '').trim()) return 'Informe o nome do kit.';
        if (!kit.faturamento) return 'Selecione o faturamento antes de salvar.';
        if (mangueiras.length === 0 && !temTerminal) return 'Selecione ao menos uma mangueira ou terminal.';
        if (mangueiras.some(item => !item.mm || Number(item.mm) <= 0)) return 'Informe o comprimento de todas as mangueiras.';
        if (mangueiras.length > 0 && !componenteSelecionado(kit.conjunto1)) return 'Selecione o Terminal A.';
        if (mangueiras.length > 0 && !componenteSelecionado(kit.conjunto2)) return 'Selecione o Terminal B.';
        return '';
    }

    return { numeroDeMoeda, calcularItemComIpi, calcularTotal, calcularValoresProposta, componenteSelecionado, erroValidacaoKit };
});
