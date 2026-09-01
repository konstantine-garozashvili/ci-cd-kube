const { notFoundHandler, errorHandler } = require('../../src/middleware/errorHandler');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('Unit: error handling middleware', () => {
  it('notFoundHandler responds 404 with the attempted route', () => {
    const res = mockRes();
    notFoundHandler({ method: 'GET', originalUrl: '/missing' }, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json.mock.calls[0][0]).toMatchObject({
      status: 404,
      error: 'Not Found',
      message: 'Cannot GET /missing',
    });
  });

  it('errorHandler honours an explicit status code', () => {
    const res = mockRes();
    const err = Object.assign(new Error('teapot'), { status: 418, name: 'TeapotError' });
    errorHandler(err, {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(418);
    expect(res.json.mock.calls[0][0]).toMatchObject({ status: 418, message: 'teapot' });
  });

  it('errorHandler defaults to 500 and never leaks a stack outside development', () => {
    const previous = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    jest.resetModules();
    const { errorHandler: prodHandler } = require('../../src/middleware/errorHandler');

    const res = mockRes();
    prodHandler(new Error('boom'), {}, res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json.mock.calls[0][0].stack).toBeUndefined();

    process.env.NODE_ENV = previous;
    jest.resetModules();
  });
});
