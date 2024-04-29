// -------------- CONVERT DOCS INTO PDF -------------- //

// const express = require("express");
// const multer = require("multer");
// const docxToPDF = require("docx-pdf");
// const cors = require("cors");
// const path = require("path");
// const app = express();

// app.use(cors());

// // setting up the file storage
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, "uploads");
//   },
//   filename: function (req, file, cb) {
//     cb(null, file.originalname);
//   },
// });

// const upload = multer({ storage: storage });

// app.post("/convertFile", upload.single("file"), (req, res, next) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: "No file uploaded" });
//     }

//     //   defining output file path
//     let outputPath = path.join(
//       __dirname,
//       "files",
//       `${req.file.originalname}.pdf`
//     );

//     docxToPDF(req.file.path, outputPath, (err, result) => {
//       if (err) {
//         console.log(err);
//         return res.status(500).json({
//           message: "Something went wrong",
//           error: err,
//         });
//       }

//       res.download(outputPath, () => {
//         console.log("file downloaded");
//       });
//     });
//   } catch (err) {
//     console.log(err);
//     res.status(500).send(err);
//   }
// });

// app.listen(5000, () => {
//   console.log("App listening on port 5000!");
// });

// ------------- CONVERT DOCUMENTS AND PHOTOS INTO PDF -------------- //

const express = require("express");
const multer = require("multer");
const PDFDocument = require("pdfkit");
const mammoth = require("mammoth");
const htmlToPdf = require("html-pdf");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const sanitizeHtml = require("sanitize-html");
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create the output directory if it doesn't exist
const outputDirectory = path.join(__dirname, "output");
if (!fs.existsSync(outputDirectory)) {
  fs.mkdirSync(outputDirectory);
}

// Create the uploads directory if it doesn't exist
const uploadsDirectory = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDirectory)) {
  fs.mkdirSync(uploadsDirectory);
}

// setting up the file storage for documents and photos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads");
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage: storage });

// Endpoint to convert documents and photos to PDF
app.post("/convertFile", upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    //   defining output file path
    let outputPath = path.join(
      __dirname,
      "output",
      `${req.file.originalname}.pdf`
    );

    console.log("Output path:", outputPath); // Log output path for debugging

    // Check file type to determine conversion method

    if (req.file.mimetype === "application/pdf") {
      // If uploaded file is already a PDF, just copy it to output directory
      fs.copyFileSync(req.file.path, outputPath);
      res.download(outputPath, () => {
        console.log("File downloaded");
      });
    } else if (req.file.mimetype.startsWith("image/")) {
      // If uploaded file is an image, convert it to PDF
      const doc = new PDFDocument();
      const writeStream = fs.createWriteStream(outputPath);
      doc.pipe(writeStream);

      doc.image(req.file.path, { fit: [250, 300] }); // Adjust image size as needed
      doc.end();
      writeStream.on("finish", () => {
        res.download(outputPath, () => {
          console.log("File downloaded");
          // Delete the uploaded photo after download
          fs.unlinkSync(req.file.path);
        });
      });
    } else if (
      req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      req.file.mimetype === "application/msword"
    ) {
      // Define paths
      const docxFilePath = req.file.path;
      const pdfFilePath = path.join(
        __dirname,
        "output",
        `${req.file.originalname}.pdf`
      );

      console.log("DOCX file path:", docxFilePath); // Log DOCX file path for debugging
      console.log("PDF file path:", pdfFilePath); // Log PDF file path for debugging

      // Convert DOCX to HTML
      const { value: html } = await mammoth.convertToHtml({
        path: docxFilePath,
      });

      console.log("HTML:", html); // Log HTML content for debugging

      // Sanitize HTML
      const sanitizedHtml = sanitizeHtml(html, {
        allowedTags: sanitizeHtml.defaults.allowedTags.concat(["img"]),
        allowedAttributes: {
          img: ["src", "alt"],
        },
      });

      console.log("Sanitized HTML:", sanitizedHtml); // Log sanitized HTML for debugging

      // Options for PDF generation
      const pdfOptions = {
        format: "A4", // You can change this to other formats like 'Letter', 'Legal', etc.
        orientation: "portrait", // You can change this to 'landscape' if needed
      };

      // Convert HTML to PDF
      htmlToPdf.create(sanitizedHtml, pdfOptions).toFile(pdfFilePath, (err) => {
        if (err) {
          console.error("Error during PDF generation:", err);
          return res.status(500).json({
            message: "Something went wrong during PDF generation",
            error: err.toString(),
          });
        }

        // Send the PDF for download
        res.download(pdfFilePath, () => {
          console.log("File downloaded");
          // Delete the uploaded file after download
          fs.unlinkSync(docxFilePath);
        });
      });
    } else {
      // Unsupported file type
      return res.status(400).json({ message: "Unsupported file type" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.listen(5000, () => {
  console.log("App listening on port 5000!");
});
