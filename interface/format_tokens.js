const fullTokensType = 'full';
const isString = n => typeof n === 'string';
const {round} = Math;
const roundedTokensType = 'rounded';
const tokensAsBigUnit = tokens => (tokens / 1e8).toFixed(8);

/**
 * Format tokens for display
 * @param {string} [none] No Value Substitute
 * @param {number} tokens Tokens
 * @returns {{display: string}} Formatted Tokens
 */
function formatTokens({ none, tokens }) {
  if (isString(none) && !tokens) {
    return { display: none };
  }

  // Exit early for tokens environment displays the value with no leading zero
  if (process.env.PREFERRED_TOKENS_TYPE === fullTokensType) {
    return { display: tokens.toLocaleString() };
  }

  // Exit early for tokens environment displaying a rounded, non-leading zero
  if (process.env.PREFERRED_TOKENS_TYPE === roundedTokensType) {
    return { display: round(tokens).toLocaleString() };
  }

  return { display: tokensAsBigUnit(tokens) };
}

export default formatTokens;
