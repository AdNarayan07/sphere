const { getUser, createNewUser, createSessionToken, initialiseCreatedUser, createChallengeForWalletCreation, fetchWallets, fetchTokens, createChallengeForOutboundTransfer, fetchTransactions, changePin, restorePin } = require('./circle-functions')
module.exports = {
    validateSignin: async function (req, profile) {
        try {
            const { data, status } = await getUser(profile.id)
            return await sendUserData(data, status, profile)
        } catch (e) {
            if (e.response.status === 404) {
                try {
                    const { status } = await createNewUser(profile.id)
                    return {
                        initialised: false,
                        status,
                        profile,
                        appId: process.env.APP_ID
                    }
                } catch (e) {
                    return { status: null, error: e }
                }
            }
            else return { status: null, error: e }
        }
    },
    initialiseCreatedUser: async function (req, profile) {
        try {
            const { data, status } = await createSessionToken(profile.id)
            let idempotencyKey = require('uuidv4').uuid()
                const { userToken } = data
                const response = await initialiseCreatedUser(profile.id, userToken, req.query.blockchain, req.query.name || '', req.query.description || '', idempotencyKey)
                return {
                    ...response.data, status: response.status, ...data, appId: process.env.APP_ID
                }
        } catch (e) {
            return { status: null, error: e }
        }
    },
    getUserData: async function (req, profile) {
        try {
            const { data, status } = await getUser(profile.id)
            return await sendUserData(data, status, profile, req.query.firstWalletId)
        } catch (e) {
            if (e.response.status === 404) {
                try {
                    const { status } = await createNewUser(profile.id)
                    return {
                        initialised: false,
                        status,
                        profile,
                        appId: process.env.APP_ID
                    }
                } catch (e) {
                    return { status: null, error: e }
                }
            }
            else return { status: null, error: e }
        }
    },
    fetchTransactions: async function(req, profile) {
        try {
            const { walletId, date, page } = req.query
            const token = await createSessionToken(profile.id)
            let pageBefore = page?.type === 'prev' ? page?.lastId : undefined
            let pageAfter = page?.type === 'next' ? page?.lastId : undefined

            const response = await fetchTransactions(token.data.userToken, walletId, date, pageBefore, pageAfter)
            let transactions = response.data.transactions
            let lastOfType = false
            if (page?.type === "next"){
                if(transactions.length < 11) {
                    lastOfType = true
                } else {
                    transactions.pop()
                }
            } else if (page?.type === "prev") {
                if(transactions.length < 11) {
                    lastOfType = true
                } else {
                    transactions.shift()
                }
            } else {
                if(transactions.length < 11) {
                    lastOfType = true
                } else { 
                    transactions.pop()
                }
            }
            return { transactions, status: response.status, lastOfType, type: page?.type }
        } catch (e) {
            return { status: null, error: e }
        }
    },
    changePin: async function(req, profile){
        try {
            let idempotencyKey = require('uuidv4').uuid()
            const token = await createSessionToken(profile.id)
            const response = await changePin(token.data.userToken, profile.id, idempotencyKey)
            return { ...response.data, ...token.data, status: response.status, appId: process.env.APP_ID}
        } catch (e) {
            return { status: null, error: e }
        }
    },
    restorePin: async function(req, profile){
        try {
            let idempotencyKey = require('uuidv4').uuid()
            const token = await createSessionToken(profile.id)
            const response = await restorePin(token.data.userToken, profile.id, idempotencyKey)
            return { ...response.data, ...token.data, status: response.status, appId: process.env.APP_ID}
        } catch (e) {
            return { status: null, error: e }
        }
    },
    createNewWallet: async function (req, profile) {
        try {
            const { data, status } = await createSessionToken(profile.id)
                const { userToken } = data
                const response = await createChallengeForWalletCreation(profile.id, userToken, req.query.blockchain, req.query.name || '', req.query.description || '')
                return {
                    ...response.data, status, ...data, appId: process.env.APP_ID
                }
        } catch (e) {
            return { status: null, error: e }
        }
    },
    getTokens: async function(req, profile) {
        try {
            const sessionTokenResponse = await createSessionToken(profile.id)
            const response = await fetchTokens(profile.id, req.query.id, sessionTokenResponse.data.userToken)
            return { ...response.data, status: response.status }
        } catch (e) {
            return { status: null, error: e }
        }
    },
    sendTransaction: async function(req, profile) {
        try {
            const { data, status } = await createSessionToken(profile.id)
            const { destination, amount, tokenId, walletId } = req.query
            const idempotencyKey = require('uuidv4').uuid()
            const response = await createChallengeForOutboundTransfer(profile.id, walletId, amount, tokenId, destination, data.userToken, idempotencyKey)
            return { ...response.data, status: response.status, ...data, appId: process.env.APP_ID }
        } catch (e) {
            return { status: null, error: e }
        }
    }
}

async function sendUserData(data, status, profile, firstWalletId) {
    let initialised = data?.user?.pinStatus === "ENABLED" && data?.user?.securityQuestionStatus === "ENABLED";
    if (initialised) {
        const sessionTokenResponse = await createSessionToken(data.user.id)
        const wallet = await fetchWallets(data.user.id, sessionTokenResponse.data.userToken)
        let wallets = wallet.data.wallets
        let tokens = []
        if(wallets.length){
            let firstWallet = wallets.filter((e)=>e.id === firstWalletId)
            if (firstWallet[0]) {
                wallets = wallets.filter((e) => e.id !== firstWalletId);
                wallets.unshift(firstWallet[0]);
            }
            const tokensResponse = await fetchTokens(data.user.id, wallets[0]?.id, sessionTokenResponse.data.userToken)
            tokens = tokensResponse.data.tokenBalances || []
        }
        return {
            initialised,
            wallets,
            tokensForFirstWallet: tokens,
            status,
            ...data,
            appId: process.env.APP_ID,
            profile
        }
    } else return {
        initialised,
        status,
        ...data,
        appId: process.env.APP_ID,
        profile
    }
}