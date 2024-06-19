
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
const os = require('os');

// 解析 JSON 格式的请求体
app.use(express.json({ limit: '500mb' }));

// 解析 URL-encoded 格式的请求体
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

app.use(bodyParser.json({ limit: '500mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '500mb' }));

// Create application/x-www-form-urlencoded parser
const urlencodedParser = bodyParser.urlencoded({ extended: false, limit: '500mb' });
app.use(cors());

app.use(express.static('public'));

app.post('/ttif', async function (req, res) {
	const svgString = req.body.svgString;
	const filename = req.body.filename || "unknown";
	const printSize = req.body.printSize || "4x6"
	const format = req.body.format || "png"
	const sizeUnit = req.body.sizeUnit
	let width = req.body.width
	let height = req.body.height
	const dpi = req.body.dpi || 72
	const quality = req.body.quality
	const channel = req.body.channel
	const sizeOption = req.body.sizeOption
	const chromaSubsampling = req.body.chromaSubsampling
	const compressionLevel = req.body.compressionLevel
	const alphaQuality = req.body.alphaQuality
	const lossless = req.body.lossless


	if(sizeUnit === 'inch') {
		width = width * dpi;
		height = height * dpi;
	}

	if(sizeOption === '1') {
		height = undefined
	}
	if(sizeOption === '2') {
		width = undefined
	}



	if (!svgString) {
		return res.status(400).send('No SVG data provided.');
	}

	let data

	try	{
		if(format === 'jpeg') {
			data = await sharp(Buffer.from(svgString), {
				unlimited: true
			}).resize({
				width: width ? Math.round(width) : undefined,
				height: height ? Math.round(height) : undefined,
				fit: sizeOption === '0' ?  undefined : 'inside', // 保持宽高比，确保图像完整显示
			})
				.toFormat('jpeg', {
					quality: quality,
					progressive: true,
					chromaSubsampling: chromaSubsampling // 需要增加这个设置
				})
				.toBuffer()
			res.setHeader('Content-Disposition', `attachment; filename=${encodeURI(filename)}.${format}`);
			res.setHeader('Content-Type', 'image/*');
			res.send(data);
		}
		if(format === 'png') {
			data = await sharp(Buffer.from(svgString), {
				unlimited: true
			}).resize({
				width: width ? Math.round(width) : undefined,
				height: height ? Math.round(height) : undefined,
				fit: sizeOption === '0' ?  'cover' : 'inside', // 保持宽高比，确保图像完整显示
			})
				.toFormat('png', {
					quality: quality,
					compressionLevel: compressionLevel // 需要增加这个设置
				}).toBuffer()

			res.setHeader('Content-Disposition', `attachment; filename=${encodeURI(filename)}.${format}`);
			res.setHeader('Content-Type', 'image/*');
			res.send(data);
		}

		if(format === 'tiff') {
			if(channel === 'cmyk') {
				data = await sharp(Buffer.from(svgString), {
					unlimited: true
				}).resize({
					width: width ? Math.round(width) : undefined,
					height: height ? Math.round(height) : undefined,
					fit: sizeOption === '0' ?  undefined : 'inside', // 保持宽高比，确保图像完整显示
				})

					.toColourspace(channel)
					.toFormat('tiff', {
						quality: quality,
						compression: 'lzw'
					}).toBuffer()
			} else {
				data = await sharp(Buffer.from(svgString), {
					unlimited: true
				}).resize({
					width: width ? Math.round(width) : undefined,
					height: height ? Math.round(height) : undefined,
					fit: sizeOption === '0' ?  undefined : 'inside', // 保持宽高比，确保图像完整显示
				})
					.withMetadata({ density: dpi })
					.toFormat('tiff', {
						quality: quality,
						compression: 'lzw'
					}).toBuffer()

			}


			res.setHeader('Content-Disposition', `attachment; filename=${encodeURI(filename)}.${format}`);
			res.setHeader('Content-Type', 'image/*');
			res.send(data);


		}

		if(format === 'webp') {
			data = await sharp(Buffer.from(svgString), {
				unlimited: true
			}).resize({
				width: width ? Math.round(width) : undefined,
				height: height ? Math.round(height) : undefined,
				fit: sizeOption === '0' ?  undefined : 'inside', // 保持宽高比，确保图像完整显示
			})
				.toFormat('webp', {
					quality: quality,
					lossless: lossless, // 需要添加这两个
					alphaQuality: alphaQuality,
				}).toBuffer()

			res.setHeader('Content-Disposition', `attachment; filename=${encodeURI(filename)}.${format}`);
			res.setHeader('Content-Type', 'image/*');
			res.send(data);
		}

	} catch (err) {
		console.error('Error converting SVG to TIFF:', err);
		res.status(500).send('Error converting SVG to TIFF.');
	}




	// TODO, 需要一个一个的测试，特别是对文档需要了解。
	// console.log(width, height)
	// sharp(Buffer.from(svgString))
	// 	.resize({
	// 		width: Math.round(width),
	// 		height: Math.round(height),
	// 		fit: sizeOption === '0' ?  undefined : 'inside', // 保持宽高比，确保图像完整显示
	// 		// withoutEnlargement: true // 防止放大图像
	// 	})
	// 	.withMetadata({ icc: "cmyk" })
	// 	// .quality(quality)
	// 	.toFormat(format)
	// 	// .channel(channel === 'cmyk' ? 4: 3)
	// 	.withIccProfile(channel)
	// 	// .space(channel)
	// 	// .density(dpi)
	// 	.withMetadata({ density: dpi })
	// 	.toBuffer()
	// 	.then(data => {
	// 		// 设置响应类型和强制下载的文件名
	// 		res.setHeader('Content-Disposition', `attachment; filename=${filename}.${format}`);
	// 		res.setHeader('Content-Type', 'image/*');
	// 		res.send(data);
	// 	})
	// 	.catch(err => {
	// 		console.error('Error converting SVG to TIFF:', err);
	// 		res.status(500).send('Error converting SVG to TIFF.');
	// 	});
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
