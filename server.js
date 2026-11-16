const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const path = require("path");

const banco = require("./banco");

const app = express();

const PORTA = Number(process.env.PORT || 3000);

function dbRun(sql, parametros = []) {
    return new Promise((resolve, reject) => banco.run(sql, parametros, function (erro) {
        if (erro) return reject(erro);
        resolve({ lastID: this.lastID, changes: this.changes });
    }));
}

function dbGet(sql, parametros = []) {
    return new Promise((resolve, reject) => banco.get(sql, parametros, (erro, linha) => erro ? reject(erro) : resolve(linha)));
}

function dbAll(sql, parametros = []) {
    return new Promise((resolve, reject) => banco.all(sql, parametros, (erro, linhas) => erro ? reject(erro) : resolve(linhas)));
}

function validarCPF(valor) {
    const cpf = String(valor || "").replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    let soma = 0;
    for (let i = 0; i < 9; i++) soma += Number(cpf[i]) * (10 - i);
    let digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    if (digito !== Number(cpf[9])) return false;
    soma = 0;
    for (let i = 0; i < 10; i++) soma += Number(cpf[i]) * (11 - i);
    digito = (soma * 10) % 11;
    if (digito === 10) digito = 0;
    return digito === Number(cpf[10]);
}


// ==================================================
// CONFIGURAÇÕES
// ==================================================

app.use(express.json());

app.use(
    express.urlencoded({
        extended: true
    })
);


// ==================================================
// SESSÃO
// ==================================================

app.use(
    session({

        secret: "fila-zero-secreto",

        resave: false,

        saveUninitialized: false

    })
);


// ==================================================
// ARQUIVOS DO SITE
// IMPORTANTE: DEVE FICAR ANTES DAS ROTAS
// ==================================================

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);


// ==================================================
// PÁGINA INICIAL
// ==================================================

app.get("/", (req, res) => {

    // Não está logado
    if (!req.session.usuario) {

        return res.redirect("/login.html");

    }


    // Usuário da cantina
    if (
        req.session.usuario.tipo === "cantina"
    ) {

        return res.redirect("/painel.html");

    }


    // Usuário aluno
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );

});


// ==================================================
// PAINEL DA CANTINA
// ==================================================

app.get("/painel.html", (req, res) => {

    if (!req.session.usuario) {

        return res.redirect("/login.html");

    }


    if (
        req.session.usuario.tipo !== "cantina"
    ) {

        return res.redirect("/");

    }


    res.sendFile(
        path.join(
            __dirname,
            "public",
            "painel.html"
        )
    );

});

// ==================================================
// CADASTRO DE NOVOS ALUNOS
// ==================================================

app.post("/cadastro", (req, res) => {
   
    console.log("ROTA DE CADASTRO ACESSADA!");
    
    const {
        nome,
        email,
        matricula,
        senha,
        confirmarSenha
    } = req.body;


    // Verificar campos
    if (
        !nome ||
        !email ||
        !matricula ||
        !senha ||
        !confirmarSenha
    ) {

        return res.json({

            sucesso: false,

            mensagem: "Preencha todos os campos."

        });

    }


    // Organizar os dados
    const nomeLimpo = nome.trim();

    const emailLimpo = email.trim().toLowerCase();

    const matriculaLimpa = matricula.trim();

    
    // Verificar tamanho da senha
    if (senha.length < 6) {

        return res.json({

            sucesso: false,

            mensagem: "A senha deve ter pelo menos 6 caracteres."

        });

    }


    // Confirmar senha
    if (senha !== confirmarSenha) {

        return res.json({

            sucesso: false,

            mensagem: "As senhas não coincidem."

        });

    }


    // Verificar se já existe e-mail ou matrícula
    banco.get(

        `
        SELECT id
        FROM usuarios
        WHERE email = ?
        OR matricula = ?
        `,

        [emailLimpo, matriculaLimpa],

        (erro, usuarioExistente) => {

            if (erro) {

                console.log(erro);

                return res.status(500).json({

                    sucesso: false,

                    mensagem: "Erro ao verificar cadastro."

                });

            }


            // Usuário já cadastrado
            if (usuarioExistente) {

                return res.json({

                    sucesso: false,

                    mensagem: "Este e-mail ou matrícula já está cadastrado."

                });

            }


            // Proteger a senha
            const senhaCriptografada =
                bcrypt.hashSync(senha, 10);


            // Salvar aluno no banco
            banco.run(

                `
                INSERT INTO usuarios
                (
                    nome,
                    email,
                    matricula,
                    senha,
                    tipo
                )

                VALUES (?, ?, ?, ?, ?)
                `,

                [
                    nomeLimpo,
                    emailLimpo,
                    matriculaLimpa,
                    senhaCriptografada,
                    "aluno"
                ],

                function(erro) {

                    if (erro) {

                        console.log(erro);

                        return res.status(500).json({

                            sucesso: false,

                            mensagem: "Não foi possível realizar o cadastro."

                        });

                    }


                    res.json({

                        sucesso: true,

                        mensagem: "Cadastro realizado com sucesso!"

                    });

                }

            );

        }

    );

});

// ==================================================
// LOGIN
// ==================================================

app.post("/login", (req, res) => {

    const { email, senha } = req.body;


    banco.get(

        `
        SELECT *
        FROM usuarios
        WHERE email = ?
        OR matricula = ?
        `,

        [email, email],

        (erro, usuario) => {

            if (erro) {

                console.log(erro);

                return res.json({

                    sucesso: false,

                    mensagem:
                        "Erro ao consultar o banco."

                });

            }


            if (!usuario) {

                return res.json({

                    sucesso: false,

                    mensagem:
                        "Usuário não encontrado."

                });

            }


            const senhaCorreta =
                bcrypt.compareSync(
                    senha,
                    usuario.senha
                );


            if (!senhaCorreta) {

                return res.json({

                    sucesso: false,

                    mensagem:
                        "Senha incorreta."

                });

            }


            // Salvar usuário na sessão

            req.session.usuario = {

                id: usuario.id,

                nome: usuario.nome,

                email: usuario.email,

                matricula:
                    usuario.matricula,

                tipo: usuario.tipo

            };


            // Enviar resposta

            res.json({

                sucesso: true,

                tipo: usuario.tipo

            });

        }

    );

});


// ==================================================
// USUÁRIO LOGADO
// ==================================================

app.get("/api/usuario", (req, res) => {

    if (!req.session.usuario) {

        return res.status(401).json({

            mensagem:
                "Usuário não está logado."

        });

    }


    res.json(
        req.session.usuario
    );

});


// ==================================================
// PRODUTOS PARA O ALUNO
// ==================================================

app.get("/api/produtos", (req, res) => {

    banco.all(

        `
        SELECT *

        FROM produtos

        WHERE disponivel = 1
          AND COALESCE(excluido, 0) = 0

        ORDER BY categoria, nome
        `,

        [],

        (erro, produtos) => {

            if (erro) {

                console.log(erro);

                return res.status(500).json({

                    mensagem:
                        "Erro ao buscar produtos."

                });

            }


            res.json(produtos);

        }

    );

});


// ==================================================
// CRIAR PEDIDO COM PAGAMENTO SIMULADO
// ==================================================
app.post("/api/pedidos", async (req, res) => {
    if (!req.session.usuario) return res.status(401).json({ sucesso: false, mensagem: "Você precisa estar logado." });
    if (req.session.usuario.tipo !== "aluno") return res.status(403).json({ sucesso: false, mensagem: "Somente alunos podem fazer pedidos." });

    const { horarioRetirada, itens, formaPagamento } = req.body;
    const metodo = String(formaPagamento || "pix");
    if (!["pix", "cartao", "retirada"].includes(metodo)) return res.status(400).json({ sucesso: false, mensagem: "Escolha uma forma de pagamento válida." });
    if (!horarioRetirada || !/^\d{2}:\d{2}$/.test(horarioRetirada)) return res.status(400).json({ sucesso: false, mensagem: "Escolha um horário de retirada válido." });
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 30) return res.status(400).json({ sucesso: false, mensagem: "O carrinho está vazio ou contém itens demais." });

    try {
        const itensValidados = [];
        for (const item of itens) {
            const produtoId = Number(item.id);
            const quantidade = Number(item.quantidade);
            if (!Number.isInteger(produtoId) || !Number.isInteger(quantidade) || quantidade < 1 || quantidade > 50) return res.status(400).json({ sucesso: false, mensagem: "Há um produto ou quantidade inválida no carrinho." });
            const produto = await dbGet("SELECT id, nome, preco, disponivel FROM produtos WHERE id = ? AND COALESCE(excluido, 0) = 0", [produtoId]);
            if (!produto || !produto.disponivel) return res.status(400).json({ sucesso: false, mensagem: "Um dos produtos não está mais disponível. Atualize o cardápio." });
            itensValidados.push({ id: produto.id, preco: Number(produto.preco), quantidade });
        }

        const total = Number(itensValidados.reduce((soma, item) => soma + item.preco * item.quantidade, 0).toFixed(2));
        const codigo = "FZ" + Math.floor(100000 + Math.random() * 900000);
        const statusInicial = metodo === "retirada" ? "Recebido" : "Aguardando pagamento";
        const pagamentoInicial = metodo === "retirada" ? "Pagar na retirada" : "Pendente";
        const pedido = await dbRun(
            `INSERT INTO pedidos (usuario_id, horario_retirada, total, status, codigo_retirada, pagamento_status, forma_pagamento) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.session.usuario.id, horarioRetirada, total, statusInicial, codigo, pagamentoInicial, metodo]
        );
        const pedidoId = pedido.lastID;
        for (const item of itensValidados) {
            await dbRun(`INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco) VALUES (?, ?, ?, ?)`, [pedidoId, item.id, item.quantidade, item.preco]);
        }

        return res.status(201).json({
            sucesso: true,
            pedidoId,
            codigo,
            total,
            formaPagamento: metodo,
            pagamentoStatus: pagamentoInicial,
            simulacao: metodo !== "retirada"
        });
    } catch (erro) {
        console.error("Erro ao criar pedido:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível criar o pedido." });
    }
});

// O aluno confirma uma aprovação fictícia, exclusivamente para demonstração escolar.
// Esta rota NÃO recebe dados bancários e NÃO movimenta dinheiro.
app.put("/api/pedidos/:id/pagamento-simulado", async (req, res) => {
    if (!req.session.usuario || req.session.usuario.tipo !== "aluno") {
        return res.status(401).json({ sucesso: false, mensagem: "Acesso não autorizado." });
    }
    const pedidoId = Number(req.params.id);
    if (!Number.isInteger(pedidoId) || pedidoId <= 0) {
        return res.status(400).json({ sucesso: false, mensagem: "Pedido inválido." });
    }
    try {
        const pedido = await dbGet(
            "SELECT id, forma_pagamento, pagamento_status FROM pedidos WHERE id = ? AND usuario_id = ?",
            [pedidoId, req.session.usuario.id]
        );
        if (!pedido) return res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado." });
        if (!["pix", "cartao"].includes(pedido.forma_pagamento)) {
            return res.status(400).json({ sucesso: false, mensagem: "Este pedido não utiliza pagamento online simulado." });
        }
        if (pedido.pagamento_status === "Pago") {
            return res.json({ sucesso: true, pagamentoStatus: "Pago", mensagem: "Pagamento já estava confirmado." });
        }
        const resultado = await dbRun(
            "UPDATE pedidos SET pagamento_status = 'Pago', status = CASE WHEN status = 'Aguardando pagamento' THEN 'Recebido' ELSE status END WHERE id = ? AND usuario_id = ? AND pagamento_status = 'Pendente'",
            [pedidoId, req.session.usuario.id]
        );
        if (!resultado.changes) return res.status(409).json({ sucesso: false, mensagem: "Não foi possível confirmar este pagamento." });
        return res.json({ sucesso: true, pagamentoStatus: "Pago", simulacao: true });
    } catch (erro) {
        console.error("Erro no pagamento simulado:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível confirmar o pagamento simulado." });
    }
});

// ==================================================
// CONSULTAR STATUS DO PAGAMENTO (aluno dono do pedido)
// ==================================================
app.get("/api/pedidos/:id/pagamento", async (req, res) => {
    if (!req.session.usuario || req.session.usuario.tipo !== "aluno") return res.status(401).json({ sucesso: false, mensagem: "Acesso não autorizado." });
    try {
        const pedido = await dbGet(
            "SELECT id, pagamento_status, status, forma_pagamento FROM pedidos WHERE id = ? AND usuario_id = ?",
            [Number(req.params.id), req.session.usuario.id]
        );
        if (!pedido) return res.status(404).json({ sucesso: false, mensagem: "Pedido não encontrado." });
        return res.json({ sucesso: true, ...pedido, simulacao: ["pix", "cartao"].includes(pedido.forma_pagamento) });
    } catch (erro) {
        console.error(erro);
        return res.status(500).json({ sucesso: false, mensagem: "Não foi possível consultar o pagamento." });
    }
});

// A cantina confirma manualmente o pagamento feito no balcão.
app.put("/api/pedidos/:id/confirmar-pagamento", async (req, res) => {
    if (!req.session.usuario || req.session.usuario.tipo !== 'cantina') return res.status(403).json({ sucesso: false, mensagem: 'Somente a cantina pode confirmar pagamentos.' });
    try {
        const resultado = await dbRun("UPDATE pedidos SET pagamento_status = 'Pago' WHERE id = ? AND forma_pagamento = 'retirada' AND pagamento_status <> 'Pago'", [Number(req.params.id)]);
        if (!resultado.changes) return res.status(409).json({ sucesso: false, mensagem: 'Pedido não encontrado ou pagamento já confirmado.' });
        res.json({ sucesso: true });
    } catch (erro) {
        console.error(erro);
        res.status(500).json({ sucesso: false, mensagem: 'Não foi possível confirmar o pagamento.' });
    }
});

// ==================================================
// MEUS PEDIDOS - ALUNO
// ==================================================

app.get(
    "/api/meus-pedidos",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "aluno"
        ) {

            return res.status(403).json({

                mensagem:
                    "Acesso permitido somente para alunos."

            });

        }


        const usuarioId =
            req.session.usuario.id;


        banco.all(

            `
            SELECT *

            FROM pedidos

            WHERE usuario_id = ?

            ORDER BY id DESC
            `,

            [usuarioId],

            (erro, pedidos) => {

                if (erro) {

                    console.log(erro);

                    return res.status(500).json({

                        mensagem:
                            "Erro ao buscar pedidos."

                    });

                }


                res.json(pedidos);

            }

        );

    }
);


// ==================================================
// TODOS OS PEDIDOS - CANTINA
// ==================================================

app.get(
    "/api/todos-pedidos",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "cantina"
        ) {

            return res.status(403).json({

                mensagem:
                    "Acesso permitido somente para a cantina."

            });

        }


        banco.all(

            `
            SELECT

                pedidos.id,

                pedidos.horario_retirada,

                pedidos.total,

                pedidos.status,

                pedidos.pagamento_status,

                pedidos.forma_pagamento,

                pedidos.codigo_retirada,

                pedidos.data_pedido,

                usuarios.nome,

                usuarios.matricula

            FROM pedidos

            INNER JOIN usuarios

            ON pedidos.usuario_id =
               usuarios.id

            ORDER BY pedidos.id DESC
            `,

            [],

            (erro, pedidos) => {

                if (erro) {

                    console.log(erro);

                    return res.status(500).json({

                        mensagem:
                            "Erro ao buscar pedidos."

                    });

                }


                res.json(pedidos);

            }

        );

    }
);


// ==================================================
// ALTERAR STATUS DO PEDIDO
// ==================================================

app.put(
    "/api/pedidos/:id/status",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                sucesso: false,

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "cantina"
        ) {

            return res.status(403).json({

                sucesso: false,

                mensagem:
                    "Somente a cantina pode alterar pedidos."

            });

        }


        const id =
            req.params.id;


        const { status } =
            req.body;


        const statusPermitidos = [

            "Recebido",

            "Em preparo",

            "Pronto",

            "Retirado"

        ];


        if (
            !statusPermitidos.includes(
                status
            )
        ) {

            return res.json({

                sucesso: false,

                mensagem:
                    "Status inválido."

            });

        }


        banco.run(
            `UPDATE pedidos SET status = ? WHERE id = ? AND (pagamento_status = 'Pago' OR forma_pagamento = 'retirada')`,
            [status, id],
            function(erro) {
                if (erro) {
                    console.log(erro);
                    return res.status(500).json({ sucesso: false, mensagem: "Erro ao atualizar." });
                }
                if (this.changes === 0) {
                    return res.status(409).json({ sucesso: false, mensagem: "Este pedido ainda não tem pagamento confirmado. Aguarde o pagamento online ou confirme na retirada." });
                }
                res.json({ sucesso: true });
            }
        );

    }
);


// ==================================================
// TODOS OS PRODUTOS - CANTINA
// ==================================================

app.get(
    "/api/todos-produtos",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "cantina"
        ) {

            return res.status(403).json({

                mensagem:
                    "Somente a cantina pode acessar esta área."

            });

        }


        banco.all(

            `
            SELECT *

            FROM produtos

            WHERE COALESCE(excluido, 0) = 0

            ORDER BY categoria, nome
            `,

            [],

            (erro, produtos) => {

                if (erro) {

                    console.log(erro);

                    return res.status(500).json({

                        mensagem:
                            "Erro ao buscar produtos."

                    });

                }


                res.json(produtos);

            }

        );

    }
);


// ==================================================
// ADICIONAR PRODUTO
// ==================================================

app.post(
    "/api/produtos",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                sucesso: false,

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "cantina"
        ) {

            return res.status(403).json({

                sucesso: false,

                mensagem:
                    "Somente a cantina pode cadastrar produtos."

            });

        }


        const {
            nome,
            descricao,
            preco,
            categoria,
            imagem
        } = req.body;


        if (
            !nome ||
            !preco ||
            !categoria
        ) {

            return res.json({

                sucesso: false,

                mensagem:
                    "Preencha nome, preço e categoria."

            });

        }


        banco.run(

            `
            INSERT INTO produtos
            (
                nome,
                descricao,
                preco,
                categoria,
                imagem,
                disponivel
            )

            VALUES (?, ?, ?, ?, ?, 1)
            `,

            [
                nome,
                descricao || "",
                Number(preco),
                categoria,
                imagem || ""
            ],

            function(erro) {

                if (erro) {

                    console.log(erro);

                    return res.status(500).json({

                        sucesso: false,

                        mensagem:
                            "Erro ao cadastrar produto."

                    });

                }


                res.json({

                    sucesso: true,

                    id: this.lastID,

                    mensagem:
                        "Produto cadastrado com sucesso!"

                });

            }

        );

    }
);


// ==================================================
// EDITAR PRODUTO
// ==================================================

app.put(
    "/api/produtos/:id",
    (req, res) => {

        if (!req.session.usuario) {

            return res.status(401).json({

                sucesso: false,

                mensagem:
                    "Você precisa estar logado."

            });

        }


        if (
            req.session.usuario.tipo !== "cantina"
        ) {

            return res.status(403).json({

                sucesso: false,

                mensagem:
                    "Somente a cantina pode editar produtos."

            });

        }


        const id =
            req.params.id;


        const {
            nome,
            descricao,
            preco,
            categoria,
            imagem,
            disponivel
        } = req.body;


        banco.run(

            `
            UPDATE produtos

            SET

                nome = ?,

                descricao = ?,

                preco = ?,

                categoria = ?,

                imagem = ?,

                disponivel = ?

            WHERE id = ?
            `,

            [
                nome,
                descricao || "",
                Number(preco),
                categoria,
                imagem || "",
                disponivel ? 1 : 0,
                id
            ],

            function(erro) {

                if (erro) {

                    console.log(erro);

                    return res.status(500).json({

                        sucesso: false,

                        mensagem:
                            "Erro ao editar produto."

                    });

                }


                res.json({

                    sucesso: true,

                    mensagem:
                        "Produto atualizado com sucesso!"

                });

            }

        );

    }
);


// ==================================================
// EXCLUIR PRODUTO
// ==================================================

app.delete(
    "/api/produtos/:id",
    (req, res) => {

        if (!req.session.usuario) {
            return res.status(401).json({
                sucesso: false,
                mensagem: "Você precisa estar logado."
            });
        }

        if (req.session.usuario.tipo !== "cantina") {
            return res.status(403).json({
                sucesso: false,
                mensagem: "Somente a cantina pode excluir produtos."
            });
        }

        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: "ID de produto inválido."
            });
        }

        // Exclusão lógica: mantém os itens_pedido e o histórico de vendas,
        // mas remove o produto do cardápio e da tela de gerenciamento.
        banco.run(
            `
            UPDATE produtos
            SET excluido = 1, disponivel = 0
            WHERE id = ? AND COALESCE(excluido, 0) = 0
            `,
            [id],
            function(erro) {
                if (erro) {
                    console.error("Erro ao excluir produto:", erro);
                    return res.status(500).json({
                        sucesso: false,
                        mensagem: "Não foi possível excluir o produto."
                    });
                }

                if (this.changes === 0) {
                    return res.status(404).json({
                        sucesso: false,
                        mensagem: "Produto não encontrado ou já excluído."
                    });
                }

                return res.json({
                    sucesso: true,
                    mensagem: "Produto excluído do cardápio com sucesso!"
                });
            }
        );
    }
);

// ==================================================
// LOGOUT
// ==================================================

app.get("/logout", (req, res) => {

    req.session.destroy(() => {

        res.redirect("/login.html");

    });

});


// ==================================================
// SERVIDOR
// ==================================================

// Só inicia o servidor depois que todas as tabelas e colunas estiverem prontas.
banco.ready
    .then(() => {
        app.listen(PORTA, () => {
            console.log("");
            console.log("==============================");
            console.log("FilaZero funcionando!");
            console.log(`http://localhost:${PORTA}`);
            console.log("Banco de dados pronto para uso.");
            console.log("Rota POST /cadastro registrada!");
            console.log("==============================");
        });
    })
    .catch((erro) => {
        console.error("O servidor não foi iniciado porque houve um erro no banco:", erro);
        process.exit(1);
    });