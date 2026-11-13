// Tests must never load the developer's ignored environment files.
require("dotenv").config = () => ({ parsed: {} });
