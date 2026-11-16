# Pagamento simulado no FilaZero

O projeto está configurado para demonstração escolar, sem integração com banco ou Mercado Pago.

## Formas de pagamento
- **Pix simulado:** o sistema exibe um resumo e permite confirmar uma aprovação fictícia. Não gera QR Code real nem código Pix válido.
- **Cartão simulado:** permite demonstrar a confirmação sem solicitar número, validade ou código de segurança. Nenhuma cobrança é feita.
- **Pagar na retirada:** o pedido fica aguardando o pagamento no balcão; a cantina confirma o recebimento pelo painel.

## Como iniciar
No PowerShell, dentro da pasta do projeto:

```powershell
npm.cmd install
npm.cmd start
```

Acesse `http://localhost:3000`. Entre com uma conta de aluno para fazer um pedido. Para testar o pagamento na retirada, entre com uma conta da cantina e confirme o recebimento no painel.

## Importante
Esta versão é apenas uma simulação para apresentação. Não use para receber pagamentos reais. Para produção será necessário integrar um provedor de pagamento, usar HTTPS, configurar credenciais privadas no servidor e validar as notificações do provedor.
