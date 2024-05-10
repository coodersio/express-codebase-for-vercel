
require('dotenv').config();

const express = require('express');
const cors = require('cors')
const app = express();
const { sql } = require('@vercel/postgres');
const multer = require('multer');
const sharp = require('sharp');
const bodyParser = require('body-parser');
const path = require('path');
const PDFDocument = require('pdfkit');
const blobStream = require('blob-stream');
const fs = require('fs');

// 设置 multer 以处理上传的文件
const storage = multer.memoryStorage(); // 使用内存存储，这样文件不会写入磁盘
const upload = multer({ storage: storage });

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(express.static("public"));


app.post('/api/upload', upload.array('images'), async function(req, res, next) {
	// 上传的文件在req.files中
	if (!req.files) {
		return res.status(400).send('No files were uploaded.');
	}

	// 裁剪图片并保存的函数
	const cropAndSaveImages = async (file) => {
		const metadata = await sharp(file.buffer).metadata();
		const cropSize = metadata.width;
		const numCrops = Math.floor(metadata.height / cropSize);
		let croppedImagePaths = [];

		for (let i = 0; i < numCrops; i++) {
			const top = i * cropSize;
			const buffer = await sharp(file.buffer).sharpen()
				.extract({ width: cropSize, height: cropSize, left: 0, top: top })
				.toBuffer();
			croppedImagePaths.push(buffer.toString('base64'));
		}

		// 处理剩余部分，如有必要
		const remaining = metadata.height % cropSize;
		if (remaining > 0) {
			const top = numCrops * cropSize;
			const buffer = await sharp(file.buffer).sharpen()
				.extract({ width: cropSize, height: remaining, left: 0, top: top })
				.toBuffer();
			croppedImagePaths.push(buffer.toString('base64'));
		}

		return croppedImagePaths;
	};

	try {
		// 对每个文件应用裁剪逻辑
		let allCroppedImages = [];
		for (const file of req.files) {
			const croppedImages = await cropAndSaveImages(file);
			allCroppedImages.push({name: file.originalname, images: croppedImages});
		}

		// 返回裁剪后的图片路径
		res.status(200).json({ croppedImages: allCroppedImages });
	} catch (err) {
		res.status(500).send(err.message);
	}
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
