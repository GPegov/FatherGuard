export default (err, req, res, next) => {
  if (err.message.includes('Ollama')) {
    console.error('AI Error:', {
      endpoint: req.originalUrl,
      input: req.body.text?.substring(0, 100),
      error: err.stack
    });
    
    return res.status(503).json({
      error: "Сервис анализа временно недоступен",
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  next(err);
};