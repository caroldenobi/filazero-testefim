const sqlite3 = require("sqlite3").verbose();
const path = require("path");

// Mantém o banco dentro da pasta do projeto.
const banco = new sqlite3.Database(path.join(__dirname, "fila-zero.db"));

function executar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        banco.run(sql, parametros, function (erro) {
            if (erro) return reject(erro);
            resolve(this);
        });
    });
}

function consultar(sql, parametros = []) {
    return new Promise((resolve, reject) => {
        banco.get(sql, parametros, (erro, linha) => {
            if (erro) return reject(erro);
            resolve(linha);
        });
    });
}

async function garantirColuna(tabela, coluna, definicao) {
    const colunas = await new Promise((resolve, reject) => {
        banco.all(`PRAGMA table_info(${tabela})`, (erro, linhas) => {
            if (erro) return reject(erro);
            resolve(linhas);
        });
    });

    if (!colunas.some(item => item.name === coluna)) {
        await executar(`ALTER TABLE ${tabela} ADD COLUMN ${coluna} ${definicao}`);
        console.log(`Coluna ${tabela}.${coluna} adicionada.`);
    }
}

async function inicializarBanco() {
    await executar("PRAGMA foreign_keys = ON");

    await executar(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        matricula TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        tipo TEXT DEFAULT 'aluno'
    )`);

    await executar(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL,
        categoria TEXT NOT NULL,
        imagem TEXT,
        disponivel INTEGER DEFAULT 1
    )`);

    await executar(`CREATE TABLE IF NOT EXISTS pedidos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        usuario_id INTEGER NOT NULL,
        horario_retirada TEXT NOT NULL,
        total REAL NOT NULL,
        status TEXT DEFAULT 'Recebido',
        codigo_retirada TEXT,
        data_pedido DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )`);

    await executar(`CREATE TABLE IF NOT EXISTS itens_pedido (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pedido_id INTEGER NOT NULL,
        produto_id INTEGER NOT NULL,
        quantidade INTEGER NOT NULL,
        preco REAL NOT NULL,
        FOREIGN KEY (pedido_id) REFERENCES pedidos(id),
        FOREIGN KEY (produto_id) REFERENCES produtos(id)
    )`);

    // Migrações compatíveis com bancos antigos: verifica cada coluna antes de criá-la.
    await garantirColuna("produtos", "excluido", "INTEGER NOT NULL DEFAULT 0");

    const colunasPagamento = [
        ["pagamento_status", "TEXT NOT NULL DEFAULT 'Pendente'"],
        ["forma_pagamento", "TEXT"],
        ["asaas_payment_id", "TEXT"],
        ["mercado_pago_payment_id", "TEXT"],
        ["mp_preference_id", "TEXT"],
        ["mp_checkout_url", "TEXT"],
        ["pix_copia_cola", "TEXT"],
        ["pix_qr_code", "TEXT"],
        ["pix_expiracao", "TEXT"]
    ];

    for (const [coluna, definicao] of colunasPagamento) {
        await garantirColuna("pedidos", coluna, definicao);
    }

    await executar(
        "UPDATE pedidos SET pagamento_status = 'Pago' WHERE forma_pagamento IS NULL AND pagamento_status = 'Pendente' AND asaas_payment_id IS NULL"
    );
    await executar(
        "UPDATE pedidos SET forma_pagamento = 'legado' WHERE forma_pagamento IS NULL"
    );

    await executar(`CREATE TABLE IF NOT EXISTS mercadopago_webhook_eventos (
        id TEXT PRIMARY KEY,
        recebido_em DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Ajusta nomes antigos de imagens sem apagar produtos.
    await executar("UPDATE produtos SET imagem = 'fran.png' WHERE imagem = 'frango.jpg'");
    await executar("UPDATE produtos SET imagem = 'su.png' WHERE imagem = 'suco.jpg'");
    await executar("UPDATE produtos SET imagem = 'macarrao.png' WHERE imagem = 'macarrao.jpg'");
    await executar("UPDATE produtos SET imagem = 'burguer.png' WHERE imagem = 'xsalada.jpg'");

    console.log("SQLite conectado e estrutura do banco verificada!");
}

banco.ready = inicializarBanco().catch(erro => {
    console.error("Erro ao preparar o banco de dados:", erro);
    throw erro;
});

module.exports = banco;
