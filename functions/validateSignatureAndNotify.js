const asn1 = require('asn1.js');
const base64url = require('base64url');
const crypto = require('crypto');
const jwkToPem = require('jwk-to-pem');
const axios = require('axios');
const nodemailer = require('nodemailer');
const { fetchTransaction, fetchWallet, tokenLookup, createSessionToken } = require('./circle-functions')

const header = `
<div style="text-align: center;">
<h1>Welcome to Sphere</h1>
<h2 style="color: #666;">Your secure space</h2>
</div>`

const footer = `
<div style="text-align: center; color: #666; margin-top: 20px;">
    Built on Circle
</div>`
const templates = {
    "challenges.initialise" : function (notificationTime) {
        return (
    `<div style="font-family: 'Segoe UI'; padding: 20px;">
    ${header}
        <div style="margin-top: 20px;">
            <p>Dear User,</p>
            <p>Thank you for joining Sphere! We're excited to have you on board.</p>
            <p>With Sphere, you can easily and securely manage your wallets, tokens and transactions.</p>
            <p></p>
            <p>Best regards,<br />Aditya Narayan,<br />Sphere</p>
        </div>
    ${footer}
    <div style="text-align: center; color: #666; margin-top: 20px;">
        ${new Date(notificationTime).toLocaleString()}
    </div>
    </div>`
        );
    },
    "transactions.inbound": function (walletId, sourceAddress, destinationAddress, tokenAmount, tokenSymbol, transactionTime, blockchain, errorReason, state, txHash, notificationTime) {
        const chainExplorer = {
            'ETH-SEPOLIA': 'https://sepolia.etherscan.io/tx/',
            'AVAX-FUJI': 'https://testnet.snowtrace.io/tx/',
            'MATIC-AMOY': 'https://amoy.polygonscan.com/tx/'
          }[blockchain];
    
        return `
            <div style="font-family: 'Segoe UI'; padding: 20px; font-size: 20px">
                ${header}
                <div style="margin-top: 20px;">
                    <p>Dear User,</p>
                    <p>We're writing to inform you about an <strong>inbound</strong> transfer to your wallet with <strong>id<strong> <span style="font-family:Monospace; background-color: silver; padding: 2px 10px; font-size: 0.9em; border-radius: 2px ">${walletId}</span>.</p>
                    <h3>Transaction Details:</h3>
                    <ul style="font-weight: bold">
                        <li>Token Amount: ${tokenAmount} ${tokenSymbol}</li>
                        <li>From: ${sourceAddress}</li>
                        <li>To: ${destinationAddress}</li>
                        <li>Transaction Time: ${new Date(transactionTime).toLocaleString()}</li>
                        <li>Blockchain: ${blockchain}</li>
                        <li>Transaction State: ${state}</li>
                        ${errorReason ? `<li>Error Reason: ${errorReason}</li>` : ""}
                        <li>Transaction Hash: <a href="${chainExplorer}/${txHash}" target="_blank">${txHash}</a></li>
                    </ul>
                    <p>Best regards,<br />Aditya Narayan,<br />Sphere</p>
                </div>
                ${footer}
                <div style="text-align: center; color: #666; margin-top: 20px;">
                    ${new Date(notificationTime).toLocaleString()}
                </div>
            </div>`;
    },
    "transactions.outbound": function (walletId, sourceAddress, destinationAddress, tokenAmount, tokenSymbol, transactionTime, blockchain, errorReason, state, txHash, notificationTime) {
        const chainExplorer = {
            'ETH-SEPOLIA': 'https://sepolia.etherscan.io/tx/',
            'AVAX-FUJI': 'https://testnet.snowtrace.io/tx/',
            'MATIC-AMOY': 'https://amoy.polygonscan.com/tx/'
        }[blockchain];
    
        return `
            <div style="font-family: 'Segoe UI'; padding: 20px; font-size: 20px">
                ${header}
                <div style="margin-top: 20px;">
                    <p>Dear User,</p>
                    <p>We're writing to inform you about an <strong>outbound transfer</strong> from your wallet with <strong>id</strong> <span style="font-family:Monospace; background-color: silver; padding: 2px 10px; font-size: 0.9em; border-radius: 2px ">${walletId}</span>.</p>
                    <h3>Transaction Details:</h3>
                    <ul style="font-weight: bold">
                        <li>Token Amount: ${tokenAmount} ${tokenSymbol}</li>
                        <li>From: ${sourceAddress}</li>
                        <li>To: ${destinationAddress}</li>
                        <li>Transaction Time: ${new Date(transactionTime).toLocaleString()}</li>
                        <li>Blockchain: ${blockchain}</li>
                        <li>Transaction State: ${state}</li>
                        ${errorReason ? `<li>Error Reason: ${errorReason}</li>` : ""}
                        <li>Transaction Hash: <a href="${chainExplorer}/${txHash}" target="_blank">${txHash}</a></li>
                    </ul>
                    <p>Best regards,<br />Aditya Narayan,<br />Sphere</p>
                </div>
                ${footer}
                <div style="text-align: center; color: #666; margin-top: 20px;">
                    ${new Date(notificationTime).toLocaleString()}
                </div>
            </div>`;
    },
    "challenges.createWallet": function(walletId, blockchain, accountType) {
        return `
            <div style="font-family: 'Segoe UI'; padding: 20px; font-size: 20px">
                ${header}
                <div style="margin-top: 20px;">
                    <p>Dear User,</p>
                    <p>We're writing to inform you that a new <strong>${accountType}</strong> wallet has been successfully created on <strong>${blockchain}</strong> blockchain. Your wallet ID is <strong>${walletId}</strong>. You can now start using your new wallet to manage your assets.</p>
                    <p>Best regards,<br />Aditya Narayan,<br />Sphere</p>
                </div>
                ${footer}
                <div style="text-align: center; color: #666; margin-top: 20px;">
                    ${new Date().toLocaleString()}
                </div>
            </div>`;
    }    
}

module.exports = async function(req){
        let { data } = await axios.request({
            method: 'GET',
            url: `https://api.circle.com/v2/notifications/publicKey/${req.headers['x-circle-key-id']}`,
            headers: {
                accept: 'application/json',
                authorization: 'Bearer ' + process.env.API_KEY
            }
            })
        // Define the EC public key ASN.1 syntax
        const EC_PUBLIC_KEY = asn1.define('ECPublicKey', function () {
            this.seq().obj(
                this.key('algorithm').seq().obj(
                    this.key('id').objid(),
                    this.key('namedCurve').objid()
                ),
                this.key('publicKey').bitstr()
            )
        });
    
        // Load the public key from the base64 encoded string
        const publicKeyBase64 = data.data.publicKey
        const publicKeyDer = base64url.toBuffer(publicKeyBase64);
        const publicKeyAsn1 = EC_PUBLIC_KEY.decode(publicKeyDer, 'der');
        const publicKeyJwk = {
            kty: 'EC',
            crv: 'P-256',
            x: publicKeyAsn1.publicKey.data.slice(1, 33).toString('base64'),
            y: publicKeyAsn1.publicKey.data.slice(33).toString('base64')
        };
        const publicKeyPem = jwkToPem(publicKeyJwk);
    
        // Load the signature you want to verify
        const signatureBase64 = req.headers['x-circle-signature']
        const signatureBytes = base64url.toBuffer(signatureBase64);
    
        // Load and format the message you want to verify
        const formattedJson = JSON.stringify(req.body, null, 0);
    
        // Verify the signature
        const verify = crypto.createVerify('SHA256');
        verify.update(formattedJson);
        verify.end();
    
        const isSignatureValid = verify.verify(publicKeyPem, signatureBytes);
        if (isSignatureValid) {
            if(!req.body.notification.userId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(req.body.notification.userId)) return console.log('not a valid email');
            const transporter = nodemailer.createTransport({
            service: 'gmail',
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: process.env.EMAIL,
              pass: process.env.PASSWORD
            },
            tls: {
                rejectUnauthorized: false
            }
          });
          let parsedHTML = ''
          let mailSubject = ''
          let acceptedTransactionState = ["COMPLETE", "CANCELED", "FAILED"]
          switch (req.body.notificationType) {
            case "challenges.initialize": {
                mailSubject = "Welcome to Sphere"
                parsedHTML = templates["challenges.initialise"](req.body.timestamp)
                break;
            }
            case "transactions.inbound":{
                if(!acceptedTransactionState.includes(req.body.notification.state)) return console.log("didnt send transaction notification cz its not the final state")
                const sessionTokenResponse = await createSessionToken(req.body.notification.userId)
                const { sourceAddress, destinationAddress, amounts } = await fetchTransaction(req.body.notification.id, sessionTokenResponse.data.userToken)
                const { symbol } = await tokenLookup(req.body.notification.tokenId)
                mailSubject = "Inbound Transfer"
                parsedHTML = templates["transactions.inbound"](req.body.notification.walletId, sourceAddress, destinationAddress, amounts[0], symbol, req.body.notification.updateDate, req.body.notification.blockchain, req.body.notification.errorReason, req.body.notification.state, req.body.notification.txHash, req.body.timestamp)
                break;
            }
            case "transactions.outbound":{
                if(!acceptedTransactionState.includes(req.body.notification.state)) return console.log("didnt send transaction notification cz its not the final state")
                const sessionTokenResponse = await createSessionToken(req.body.notification.userId)
                const { sourceAddress, destinationAddress, amounts } = await fetchTransaction(req.body.notification.id, sessionTokenResponse.data.userToken)
                const { symbol } = await tokenLookup(req.body.notification.tokenId)
                mailSubject = "Outbound Transfer"
                parsedHTML = templates["transactions.outbound"](req.body.notification.walletId, sourceAddress, destinationAddress, amounts[0], symbol, req.body.notification.updateDate, req.body.notification.blockchain, req.body.notification.errorReason, req.body.notification.state, req.body.notification.txHash, req.body.timestamp)
                break;
            }
            case "challenges.createWallet": {
                const sessionTokenResponse = await createSessionToken(req.body.notification.userId)
                const { blockchain, accountType } = await fetchWallet(req.body.notification.correlationIds[0], sessionTokenResponse.data.userToken)
                mailSubject = "New Wallet Created"
                parsedHTML = templates["challenges.createWallet"](req.body.notification.correlationIds[0], blockchain, accountType)
                break;
            }
            default:
                return console.log(req.body.notificationType, " Request Type not Handled");
          }
          const mailOptions = {
            from: {
                name: "Sphere - Your secure space",
                address: process.env.EMAIL
            },
            to: req.body.notification.userId,
            subject: mailSubject,
            html: parsedHTML
          };
          transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
              console.log(error);
            } else {
              console.log('Email sent: ' + info.response);
            }
          });
        } else {
            console.log('Signature is invalid.');
        }
};
