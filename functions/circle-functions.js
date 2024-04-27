const { initiateUserControlledWalletsClient } = require("@circle-fin/user-controlled-wallets");
const axios = require('axios');

const client = initiateUserControlledWalletsClient({apiKey: process.env.API_KEY});

async function getUser(user){
    let response = await client.getUser({
        userId: user
    })
    return { data: response.data, status: response.status }
}
async function createNewUser(user){
    let response = await client.createUser({
        userId: user,
    });
    return { data: response.data, status: response.status }
}

async function initialiseCreatedUser(user, token, blockchain, name, description, idempotencyKey){
    let response = await client.createUserPinWithWallets({
        userId: user,
        userToken: token,
        idempotencyKey,
        accountType: "SCA",
        blockchains: [blockchain],
        accountType: blockchain === "AVAX-FUJI" ? "EOA" : "SCA",
        metadata: [{
            name: name || '',
            refId: description || ''
        }],
    })
    return { data: response.data, status: response.status }
}

async function createSessionToken(user) {
    let response = await client.createUserToken({
        userId: user,
    });
    return { data: response.data, status: response.status }
}

async function createChallengeForWalletCreation(user, token, blockchain, name, description) {
    let response = await client.createWallet({
        userId: user,
        blockchains: [blockchain],
        accountType: blockchain === "AVAX-FUJI" ? "EOA" : "SCA",
        userToken: token,
        metadata: [{
            name: name || '',
            refId: description || ''
        }],
    });
    return { data: response.data, status: response.status }
}

async function fetchWallets(user) {
    const options = {
    method: 'GET',
    url: `https://api.circle.com/v1/w3s/wallets?userId=${user}`,
    headers: {
        accept: 'application/json',
        authorization: 'Bearer ' + process.env.API_KEY
    }
    }
    let response = await axios.request(options)
    return { data: response.data.data, status: response.status }
}

async function fetchTokens(user, walletId, token) {
    let response = await client.getWalletTokenBalance({
        walletId: walletId,
        userToken: token,
        userId: user,
    });
    return { data: response.data, status: response.status }
}

async function createChallengeForOutboundTransfer(user, walletId, amount, tokenId, destination, token, idempotencyKey) {
    let response = await client.createTransaction({
        idempotencyKey,
        amounts: [amount],
        destinationAddress: destination,
        tokenId: tokenId,
        walletId: walletId,
        userId: user,
        fee: {
            type: "level",
            config: {
                feeLevel: "MEDIUM",
            },
        },
        userToken: token,
    });
    return { data: response.data, status: response.status }
}

async function fetchTransactions(token, walletId, date, pageBefore, pageAfter){
    let response = await client.listTransactions({
        userToken: token,
        walletIds: [walletId],
        pageSize: 11,
        to: date,
        pageBefore,
        pageAfter
    })
    return { data: response.data, status: response.status }
}

async function changePin(token, user, idempotencyKey){
    let response = await client.updateUserPin({
        userToken: token,
        userId: user,
        idempotencyKey
    })
    return { data: response.data, status: response.status }
}

async function restorePin(token, user, idempotencyKey){
    let response = await client.restoreUserPin({
        userToken: token,
        userId: user,
        idempotencyKey
    })
    return { data: response.data, status: response.status }
}

async function fetchTransaction(id, userToken){
    let response = await client.getTransaction({
        id, userToken
    })
    return response.data.transaction
}

async function fetchWallet(id, userToken){
    let response = await client.getWallet({
        id, userToken
    })
    return response.data.wallet
}
async function tokenLookup(id){
    let response = await client.getToken({ id })
    return response.data.token
}
module.exports = { getUser, createNewUser, createSessionToken, initialiseCreatedUser, createChallengeForWalletCreation, fetchWallets, fetchTokens, createChallengeForOutboundTransfer, fetchTransactions, changePin, restorePin, fetchTransaction, fetchWallet, tokenLookup }