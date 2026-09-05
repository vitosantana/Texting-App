const express = require('express');
const multer = require('multer');
const path = require('path');

const router = express.Router();

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },

    filename: (req, file, cb) => {
        const uniqueName =
        Date.now() +
        '-' +
        Math.round(Math.random() * 1e9) +
        path.extname(file.originalname);

        cb(null, uniqueName);
    }
});

const upload = multer({
    storage
});

router.post('/', upload.single('image'), (req, res) => {
    try {
        if(!req.file) {
            return res.status(400).json({
                message: 'No image uploaded'
            });
        }

        res.status(201).json({
            imageUrl: `/uploads/${req.file.filename}`
        });
    } catch (error) {
        console.log('UPLOAD ERROR:', error);

        res.status(500).json({
            message: 'Upload failed'
        });
    }
});

module.exports = router;