const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function for delay
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

app.post('/api/bulk-stk', async (req, res) => {
    const { phones, amount, account_reference, channel_id, api_key } = req.body;
    const apiKey = api_key || process.env.FORTPESA_API_KEY;

    if (!apiKey) {
        return res.status(400).json({ error: 'API Key is missing. Provide it in the UI or set the FORTPESA_API_KEY environment variable.' });
    }

    if (!phones) {
        return res.status(400).json({ error: 'No phone numbers provided.' });
    }

    // Split numbers by newline, trim whitespace, and remove empty lines
    const phoneList = phones.split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    if (phoneList.length === 0) {
        return res.status(400).json({ error: 'No valid phone numbers found after parsing.' });
    }

    const results = [];

    // Process each number with an 8-second delay between requests
    for (let i = 0; i < phoneList.length; i++) {
        const phone = phoneList[i];

        // If not the first request, wait 8 seconds before proceeding
        if (i > 0) {
            await sleep(8000);
        }

        try {
            const idempotencyKey = `bulk-${Date.now()}-${phone}`;
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

            if (response.ok) {
                results.push({ phone, success: true, data: data.data || data });
            } else {
                results.push({ phone, success: false, error: data.message || 'Failed to trigger STK', details: data });
            }
        } catch (err) {
            results.push({ phone, success: false, error: err.message });
        }
    }

    res.json({ success: true, results });
});

app.listen(PORT, () => {
    console.log(`Fortpesa Bulk Bot server running on port ${PORT}`);
});
