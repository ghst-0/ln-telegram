import asyncAuto from 'async/auto.js';
import { getNetwork } from 'ln-sync';
import { getPrices } from '@alexbosworth/fiat';
import { parseAmount } from 'ln-accounting';
import { returnResult } from 'asyncjs-util';

const defaultFiatRateProvider = 'coingecko';
const defaultTokens = 0;
const hasFiat = n => !!n && /(eur|usd)/gim.test(n);
const {isInteger} = Number;
const isNumber = n => !isNaN(n);
const networks = {btc: 'BTC', btcregtest: 'BTC', btctestnet: 'BTC'};
const rateAsTokens = rate => 1e10 / rate;
const symbols = ['EUR', 'USD'];

/**
 * Get the tokens value for an amount string
 * @param {string} [amount] Amount
 * @param {{}} [lnd] Authenticated LND API Object
 * @param {function} [request] Request Function
 * @param {function} cbk Callback function
 * @returns {Promise<tokens: string>} tokens: <Amount>
 */
function getAmountAsTokens({ amount, lnd, request }, cbk) {
  return new Promise((resolve, reject) => {
    return asyncAuto({
        validate: cbk => {
          if (!!amount && isNumber(amount) && !isInteger(Number(amount))) {
            return cbk([400, 'ExpectedIntegerAmountToParseAmount']);
          }

          if (!!hasFiat(amount) && !lnd) {
            return cbk([400, 'ExpectedAuthenticatedLndApiToGetAmountAsTokens']);
          }

          if (!!hasFiat(amount) && !request) {
            return cbk([400, 'ExpectedRequestFunctionToGetAmountAsTokens']);
          }

          return cbk();
        },

        // Get the current fiat prices when a fiat price is present in the amount
        getFiatPrices: ['validate', ({}, cbk) => {
          // Exit early when no fiat symbol is referenced
          if (!hasFiat(amount)) {
            return cbk();
          }

          return getPrices({
              request,
              symbols,
              from: defaultFiatRateProvider
            },
            cbk);
        }],

        // Get the network to figure out what currency is being used
        getNetwork: ['validate', ({}, cbk) => {
          // Exit early when no fiat symbol is referenced
          if (!hasFiat(amount)) {
            return cbk();
          }

          return getNetwork({ lnd }, cbk);
        }],

        // Map the fiat rates
        fiatRates: [
          'getFiatPrices',
          'getNetwork',
          ({ getFiatPrices, getNetwork }, cbk) => {
            // Exit early when there is no fiat price to map
            if (!getFiatPrices) {
              return cbk();
            }

            if (!networks[getNetwork.network]) {
              return cbk([400, 'UnsupportedCurrencyForFiatConversion']);
            }

            // Map the fiats to the conversion rate
            const rates = symbols.map(fiat => {
              const { rate } = getFiatPrices.tickers.find(n => n.ticker === fiat);

              return { fiat, unit: rateAsTokens(rate) };
            });

            return cbk(null, rates);
          }],

        // Parse the amount into tokens
        parse: ['fiatRates', ({ fiatRates }, cbk) => {
          // Exit early with a default amount when no amount is specified
          if (!amount) {
            return cbk(null, { tokens: defaultTokens });
          }

          const variables = symbols.reduce((sum, fiat) => {
              // Exit early when there are no fiats
              if (!fiatRates) {
                return sum;
              }

              sum[fiat] = fiatRates.find(n => n.fiat === fiat).unit;

              return sum;
            },
            {});

          try {
            const { tokens } = parseAmount({ amount, variables });

            // Tokens from the amount
            return cbk(null, { tokens });
          } catch (err) {
            return cbk([400, 'FailedToParseAmount', { err }]);
          }
        }]
      },
      returnResult({ reject, resolve, of: 'parse' }, cbk));
  });
}

export default getAmountAsTokens;
