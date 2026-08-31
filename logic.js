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

    function calcularTotal(inputs = {}) {
        let produtos = Number(inputs.mangueiras) || 0;
        (inputs.terminais || []).forEach(valor => { produtos += Number(valor) || 0; });
        const percentualImposto = Math.max(0, Math.min(Number(inputs.imposto) || 0, 100));
        const imposto = produtos * (percentualImposto / 100);
        let subtotal = produtos + imposto;
        subtotal += Number(inputs.prensagem) || 0;
        subtotal += Number(inputs.embalagem) || 0;
        const percentual = Math.max(0, Math.min(Number(inputs.desconto) || 0, 25));
        const desconto = subtotal * (percentual / 100);
        return { produtos, percentualImposto, imposto, subtotal, desconto, total: subtotal - desconto };
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

    return { numeroDeMoeda, calcularTotal, componenteSelecionado, erroValidacaoKit };
});
