// vite.config.demo.ts
import { defineConfig } from 'vite';
import books from './demo/books.json' with { type: 'json' };

export default defineConfig({
    plugins: [
        {
            name: 'mock-books-api-with-pagination',
            configureServer(server) {
                server.middlewares.use('/api/books', (req, res) => {
                    // Extrai os parâmetros de paginação da URL do pedido
                    const url = new URL(req.url!, `http://${req.headers.host}`);
                    const page = parseInt(url.searchParams.get('page') || '1', 10);
                    const perPage = parseInt(url.searchParams.get('perPage') || '10', 10);

                    // Calcula o índice de início e fim para "fatiar" o array
                    const start = (page - 1) * perPage;
                    const end = start + perPage;

                    // "Fatia" os dados para devolver apenas a página pedida
                    const paginatedData = books.data.slice(start, end);

                    // A resposta da API
                    const responseData = {
                        data: paginatedData, // Envia apenas os dados da página atual
                        totalRecords: books.data.length // Envia o total REAL de registos
                    };

                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify(responseData));
                });
            }
        }
    ]
});