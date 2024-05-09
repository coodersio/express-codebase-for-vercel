
require('dotenv').config();

const express = require('express');
const cors = require('cors')
const app = express();
const { sql } = require('@vercel/postgres');

const bodyParser = require('body-parser');
const path = require('path');
const PDFDocument = require('pdfkit');
const sharp = require('sharp')
const fs = require('fs');
const multer  = require('multer');
const blobStream = require('blob-stream');
// 设置 multer 用于处理上传的文件
const storage = multer.memoryStorage(); // 使用内存存储，也可以使用磁盘存储
const upload = multer({ storage: storage });


// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false });

// 为 JSON 请求体设置更大的大小限制
app.use(express.json({ limit: '50mb' })); // 设置 limit 为 50mb

// 为 URL 编码的请求体设置更大的大小限制
app.use(express.urlencoded({ limit: '50mb', extended: false }));
app.use(cors());

app.use(express.static('public'));


app.post('/upload',  (req, res) => {
	res.setHeader('Content-Type', 'application/pdf');
	res.setHeader('Content-Disposition', 'attachment; filename=downloaded.pdf');
	const doc = new PDFDocument();

	const stream = doc.pipe(blobStream());

	// doc.pipe(res);

	doc
		.fontSize(25)
		.text('Some text with an embedded font!', 100, 100);
	doc.end();

	stream.on('finish', function() {
		// get a blob you can do whatever you like with
		const blob = stream.toBlob('application/pdf');
		res.status(200).send(blob)
	});
});


app.post('/pdf', function (req, res) {
	try {
		console.log(req.body.pdfBytes)  // base64
		const pdfBuffer = Buffer.from(req.body.pdfBytes);
		const texts = req.body.texts;
		const targetNode = req.body.targetNode;
		/**
		 * Hey y’all, engineer here at Figma: we just shipped an update to utilize more compression for PDF files. We now compress images using JPEG at 75% quality and compress long text streams using zlib.
		 */
		// sharp(pdfBuffer)
		// 	.resize(1000)
		// 	.jpeg({quality: 80})
		res.setHeader('Content-Type', 'application/pdf');
		res.setHeader('Content-Disposition', 'attachment; filename=downloaded.pdf');

		const doc = new PDFDocument();

		doc.pipe(res);

		// 你可以根据POST请求的数据来自定义PDF内容
		// 例如：req.body.text
		doc.image(`data:image/png;base64,${req.body.pdfBytes}`, 0, 0)

		for(const text of texts) {
			doc.fontSize(14).text(text.characters, text.x, text.y, {width: targetNode.width, height: targetNode.height})

		}

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
