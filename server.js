const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/trigger-stk', async (req, res) => {
    const { phone, amount, account_reference, channel_id, api_key } = req.body;
    const apiKey = api_key || process.env.FORTPESA_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Key is missing. Provide it in the UI or set the FORTPESA_API_KEY environment variable.' });
    }

    try {
        const idempotencyKey = `order-${Date.now()}-attempt-1`;
        const response = await fetch('https://fortpesa.co.ke/api/v1/payments/stk', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Idempotency-Key': idempotencyKey,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: Number(amount),
                phone: phone,
                account_reference: account_reference || 'INV-' + Math.floor(Math.random() * 10000),
                channel_id: Number(channel_id) || 42
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: data.message || 'Failed to initiate STK push', details: data });
        }

        res.json({ success: true, data });
    } catch (err) {
        console.error('STK Error:', err);
        res.status(500).json({ error: 'Internal server error while connecting to Fortpesa' });
    }
});

app.listen(PORT, () => {
    console.log(`Fortpesa Bot server running on port ${PORT}`);
});
