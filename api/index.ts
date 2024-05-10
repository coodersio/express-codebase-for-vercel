
require('dotenv').config();

const express = require('express');
const cors = require('cors')
const app = express();
const { sql } = require('@vercel/postgres');

const bodyParser = require('body-parser');
const path = require('path');
const PDFDocument = require('pdfkit');
const blobStream = require('blob-stream');
const fs = require('fs');
const sharp = require('sharp')


// 解析 JSON 格式的请求体
app.use(express.json({ limit: '50mb' }));

// 解析 URL-encoded 格式的请求体
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false });
app.use(cors());

app.use(express.static('public'));

app.post('/ttif', function (req, res) {
		console.log(req.body)
	const svgString = req.body.svgString;
	const filename = req.body.filename || "unknown";
	const printSize = req.body.printSize || "4x6"
	const [widthInches, heightInches] = printSize.split('x').map(Number);


	const dpi = req.body.dpi || 72

	const width = widthInches * dpi;
	const height = heightInches * dpi;

	if (!svgString) {
		return res.status(400).send('No SVG data provided.');
	}

	console.log(width, height)
	sharp(Buffer.from(svgString))
		.resize({
			width: Math.round(width),
			height: Math.round(height),
			fit: 'inside', // 保持宽高比，确保图像完整显示
			// withoutEnlargement: true // 防止放大图像
		})
		.toFormat('tiff')
		.tiff({
			compression: 'lzw',
			alpha: 'associated' // 确保 alpha 通道（透明度）被关联（保留）
		})
		.withIccProfile('cmyk')
		.withMetadata({ density: dpi })
		.toBuffer()
		.then(data => {
			// 设置响应类型和强制下载的文件名
			res.setHeader('Content-Disposition', `attachment; filename=${filename}.tiff`);
			res.setHeader('Content-Type', 'image/tiff');
			res.send(data);
		})
		.catch(err => {
			console.error('Error converting SVG to TIFF:', err);
			res.status(500).send('Error converting SVG to TIFF.');
		});
});


app.post('/pdf', function (req, res) {
	try {
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', 'attachment; filename=downloaded.pdf');

		const doc = new PDFDocument();
		doc.pipe(res);

		// 你可以根据POST请求的数据来自定义PDF内容
		// 例如：req.body.text
		doc.fontSize(25).text('Some text with an embedded font!', 100, 100);

		doc.end();
	} catch (error) {
		console.error(error);
		res.status(500).send(error.message);
	}
});

app.get('/pdf', function (req,res) {
	try {
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', 'attachment; filename=downloaded.pdf');
		const doc = new PDFDocument();

		doc.pipe(res);

		doc
			.fontSize(25)
			.text('Some text with an embedded font!', 100, 100);
		doc.end();

	} catch (error) {
		console.error(error);
		res.status(500).send(error.message);
	}
})


app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'home.htm'));
});

app.get('/about', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'about.htm'));
});

app.get('/uploadUser', function (req, res) {
	res.sendFile(path.join(__dirname, '..', 'components', 'user_upload_form.htm'));
});

app.post('/uploadSuccessful', urlencodedParser, async (req, res) => {
	try {
		await sql`INSERT INTO Users (Id, Name, Email) VALUES (${req.body.user_id}, ${req.body.name}, ${req.body.email});`;
		res.status(200).send('<h1>User added successfully</h1>');
	} catch (error) {
		console.error(error);
		res.status(500).send('Error adding user');
	}
});

app.get('/allUsers', async (req, res) => {
	try {
		const users = await sql`SELECT * FROM Users;`;
		if (users && users.rows.length > 0) {
			let tableContent = users.rows
				.map(
					(user) =>
						`<tr>
                        <td>${user.id}</td>
                        <td>${user.name}</td>
                        <td>${user.email}</td>
                    </tr>`
				)
				.join('');

			res.status(200).send(`
                <html>
                    <head>
                        <title>Users</title>
                        <style>
                            body {
                                font-family: Arial, sans-serif;
                            }
                            table {
                                width: 100%;
                                border-collapse: collapse;
                                margin-bottom: 15px;
                            }
                            th, td {
                                border: 1px solid #ddd;
                                padding: 8px;
                                text-align: left;
                            }
                            th {
                                background-color: #f2f2f2;
                            }
                            a {
                                text-decoration: none;
                                color: #0a16f7;
                                margin: 15px;
                            }
                        </style>
                    </head>
                    <body>
                        <h1>Users</h1>
                        <table>
                            <thead>
                                <tr>
                                    <th>User ID</th>
                                    <th>Name</th>
                                    <th>Email</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableContent}
                            </tbody>
                        </table>
                        <div>
                            <a href="/">Home</a>
                            <a href="/uploadUser">Add User</a>
                        </div>
                    </body>
                </html>
            `);
		} else {
			res.status(404).send('Users not found');
		}
	} catch (error) {
		console.error(error);
		res.status(500).send('Error retrieving users');
	}
});

app.listen(3000, () => console.log('Server ready on port 3000.'));

module.exports = app;
