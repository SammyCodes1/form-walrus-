const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const routes = require("./routes");
const { errorHandler } = require("./middleware");

const app = express();
const PORT = process.env.PORT || 4000;

app.use(helmet());
app.use(cors({ origin: ["http://localhost:3000", "http://localhost:3001", "http://localhost:3003"] }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: "Too many requests, please try again later.",
});

app.use("/forms/:form_id/submit", apiLimiter);

app.use("/", routes);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log("Walrus API Gateway running on port " + PORT);
});

module.exports = app;
