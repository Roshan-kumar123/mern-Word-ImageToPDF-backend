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
const docxToPDF = require("docx-pdf");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const cors = require("cors");
const path = require("path");
const { execSync } = require("child_process"); // Import execSync for executing shell commands
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
app.post("/convertFile", upload.single("file"), (req, res, next) => {
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
        });
      });
    } else if (
      req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      req.file.mimetype === "application/msword"
    ) {
      // If uploaded file is a DOCX or DOC file, convert it to PDF
      const outputPathPDF = path.join(
        __dirname,
        "output",
        `${req.file.originalname}.pdf`
      );
      const outputPathDocx = path.join(
        __dirname,
        "output",
        `${req.file.originalname}`
      );

      fs.copyFileSync(req.file.path, outputPathDocx);

      docxToPDF(outputPathDocx, outputPathPDF, (err, result) => {
        if (err) {
          console.log(err);
          return res.status(500).json({
            message: "Something went wrong",
            error: err,
          });
        }

        // Execute a shell command to convert DOCX to PDF using LibreOffice (alternative to docx-pdf)
        execSync(
          `libreoffice --convert-to pdf --outdir ${outputDirectory} ${outputPathDocx}`
        );

        // Check if conversion was successful
        if (!fs.existsSync(outputPathPDF)) {
          return res.status(500).json({
            message: "Conversion failed",
            error: "PDF file not found",
          });
        }

        fs.unlinkSync(outputPathDocx); // Delete the original DOCX file after conversion
        res.download(outputPathPDF, () => {
          console.log("File downloaded");
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
