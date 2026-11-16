const lista = document.getElementById("listaPedido");
const totalElemento = document.getElementById("total");
let carrinho = JSON.parse(localStorage.getItem("carrinho")) || [];
let pedidoAtualId = null;

function carregarPedido() {
    if (carrinho.length === 0) {
        lista.innerHTML = `<div class="mensagem-vazia"><h3>Seu carrinho está vazio.</h3><a href="cardapio.html">Voltar ao cardápio</a></div>`;
        document.getElementById("confirmar").disabled = true;
        return;
    }
    lista.innerHTML = "";
    let total = 0;
    carrinho.forEach((item, index) => {
        const subtotal = Number(item.preco) * Number(item.quantidade);
        total += subtotal;
        const div = document.createElement("div");
        div.className = "item-pedido";
        const info = document.createElement("div");
        const nome = document.createElement("h3"); nome.textContent = item.nome;
        const preco = document.createElement("p"); preco.textContent = `R$ ${Number(item.preco).toFixed(2).replace(".", ",")}`;
        info.append(nome, preco);
        const quantidade = document.createElement("div"); quantidade.className = "quantidade";
        quantidade.innerHTML = `<button type="button" aria-label="Diminuir quantidade" onclick="diminuir(${index})">−</button><strong>${item.quantidade}</strong><button type="button" aria-label="Aumentar quantidade" onclick="aumentar(${index})">+</button>`;
        const subtotalEl = document.createElement("strong"); subtotalEl.textContent = `R$ ${subtotal.toFixed(2).replace(".", ",")}`;
        div.append(info, quantidade, subtotalEl); lista.appendChild(div);
    });
    totalElemento.textContent = `R$ ${total.toFixed(2).replace(".", ",")}`;
}
function aumentar(index) { carrinho[index].quantidade++; salvar(); }
function diminuir(index) { carrinho[index].quantidade--; if (carrinho[index].quantidade <= 0) carrinho.splice(index, 1); salvar(); }
function salvar() { localStorage.setItem("carrinho", JSON.stringify(carrinho)); carregarPedido(); }

function formaSelecionada() {
    return document.querySelector('input[name="formaPagamento"]:checked')?.value || "pix";
}
function atualizarFormaPagamento() {
    const forma = formaSelecionada();
    document.getElementById("dadosPix").hidden = forma !== "pix";
    document.getElementById("avisoCartao").hidden = forma !== "cartao";
    document.getElementById("avisoRetirada").hidden = forma !== "retirada";
    document.getElementById("confirmar").textContent = forma === "pix" ? "Continuar com Pix simulado" : forma === "cartao" ? "Continuar com cartão simulado" : "Fazer pedido";
}
document.querySelectorAll('input[name="formaPagamento"]').forEach(el => el.addEventListener("change", atualizarFormaPagamento));

function formatarMoeda(valor) { return `R$ ${Number(valor).toFixed(2).replace(".", ",")}`; }

function mostrarPagamentoSimulado(dados, forma) {
    pedidoAtualId = dados.pedidoId;
    document.querySelector(".pedido-container").hidden = true;
    document.getElementById("pedidoCriado").hidden = true;
    const area = document.getElementById("pagamentoSimulado");
    area.hidden = false;
    document.getElementById("tituloPagamento").textContent = forma === "pix" ? "Pix demonstrativo" : "Cartão demonstrativo";
    document.getElementById("resumoPagamento").textContent = `Pedido ${dados.codigo} • Total: ${formatarMoeda(dados.total)}`;
    document.getElementById("instrucoesPagamento").textContent = forma === "pix"
        ? "Em um sistema real, aqui apareceria o QR Code Pix. Para este projeto, use o botão abaixo para simular a confirmação."
        : "Em um sistema real, o cartão seria processado por um provedor de pagamento. Nesta versão, não informe número, validade ou código de segurança.";
    const botao = document.getElementById("confirmarPagamentoSimulado");
    botao.hidden = false;
    botao.disabled = false;
    botao.textContent = "Confirmar pagamento simulado";
    document.getElementById("statusPagamentoSimulado").textContent = "Aguardando confirmação...";
    document.getElementById("statusPagamentoSimulado").className = "pix-status";
    botao.onclick = confirmarPagamentoSimulado;
}

async function confirmarPagamentoSimulado() {
    if (!pedidoAtualId) return;
    const botao = document.getElementById("confirmarPagamentoSimulado");
    const status = document.getElementById("statusPagamentoSimulado");
    botao.disabled = true;
    botao.textContent = "Confirmando...";
    try {
        const resposta = await fetch(`/api/pedidos/${pedidoAtualId}/pagamento-simulado`, { method: "PUT" });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Não foi possível confirmar o pagamento.");
        status.textContent = "Pagamento simulado aprovado! Seu pedido foi enviado à cantina. 💚";
        status.className = "pix-status pix-pago";
        botao.hidden = true;
        document.getElementById("irPedidos").hidden = false;
    } catch (erro) {
        status.textContent = erro.message;
        status.className = "pix-status pix-erro";
        botao.disabled = false;
        botao.textContent = "Tentar novamente";
    }
}

async function confirmarPedido() {
    if (carrinho.length === 0) return alert("Seu carrinho está vazio.");
    const horario = document.getElementById("horario").value;
    const formaPagamento = formaSelecionada();
    if (!horario) return alert("Escolha um horário de retirada.");
    const botao = document.getElementById("confirmar");
    botao.disabled = true;
    botao.textContent = "Criando pedido...";
    try {
        const resposta = await fetch("/api/pedidos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                horarioRetirada: horario,
                formaPagamento,
                itens: carrinho.map(item => ({ id: item.id, quantidade: item.quantidade }))
            })
        });
        const dados = await resposta.json();
        if (!resposta.ok || !dados.sucesso) throw new Error(dados.mensagem || "Não foi possível criar o pedido.");
        localStorage.removeItem("carrinho");
        carrinho = [];
        if (formaPagamento === "retirada") {
            document.querySelector(".pedido-container").hidden = true;
            document.getElementById("pedidoCriado").hidden = false;
            document.getElementById("pedidoCriadoTexto").textContent = `Pedido ${dados.codigo} criado! Total: ${formatarMoeda(dados.total)}. O pagamento será feito no balcão da cantina.`;
        } else {
            mostrarPagamentoSimulado(dados, formaPagamento);
        }
    } catch (erro) {
        alert(erro.message || "Não foi possível conectar ao servidor.");
        botao.disabled = false;
        atualizarFormaPagamento();
    }
}

atualizarFormaPagamento();
carregarPedido();
