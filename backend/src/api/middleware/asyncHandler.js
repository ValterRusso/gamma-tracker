/**
 * ============================================================================
 * ASYNC HANDLER MIDDLEWARE
 * ============================================================================
 * 
 * Wrapper para async route handlers
 * Elimina necessidade de try/catch em cada endpoint
 * Automaticamente passa erros para o error handler
 * 
 * ANTES:
 * router.get('/endpoint', async (req, res) => {
 *   try {
 *     const data = await someAsyncFunction();
 *     res.json(data);
 *   } catch (error) {
 *     res.status(500).json({ error: error.message });
 *   }
 * });
 * 
 * DEPOIS:
 * router.get('/endpoint', asyncHandler(async (req, res) => {
 *   const data = await someAsyncFunction();
 *   res.json(data);
 * }));
 * 
 * @author Valter Russo - Gamma Tracker Team
 * @version 1.0
 * ============================================================================
 */

/**
 * Wrap async route handlers to catch errors
 * @param {Function} fn - Async function (req, res, next) => Promise
 * @returns {Function} Express middleware
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    // Execute async function and catch any errors
    Promise.resolve(fn(req, res, next))
      .catch(next); // Pass error to error handler
  };
};

module.exports = asyncHandler;