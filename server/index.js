const express = require("express");
const app = express();

const providerRoutes = require("./routes/providerRoutes");
const errorHandler = require("./middleware/errorHandler");

app.use(express.json());

app.use("/api/providers", providerRoutes);

app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
	console.log(`Server listening on port ${PORT}`);
});
