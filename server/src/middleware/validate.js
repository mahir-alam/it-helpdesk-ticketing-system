/**
 * Build a middleware that validates and coerces parts of the request against
 * zod schemas. Replaces req[part] with the parsed value so downstream handlers
 * get typed, trimmed data.
 *
 *   router.post('/', validate({ body: createSchema }), controller.create)
 */
export function validate(schemas) {
  return (req, _res, next) => {
    try {
      for (const part of ['body', 'query', 'params']) {
        if (schemas[part]) {
          req[part] = schemas[part].parse(req[part] ?? {});
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
