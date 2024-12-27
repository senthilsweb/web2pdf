import puppeteer from "puppeteer-core";
import { NextResponse } from "next/server";

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch (error) {
    return false;
  }
};

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const header = searchParams.get("header");
  const footer = searchParams.get("footer");
  const pageNumbers = searchParams.get("pageNumbers") === "true";

  // Validate the URL parameter
  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: "Invalid or missing 'url' parameter" },
      { status: 400 }
    );
  }

  try {
    // Launch Puppeteer using Vercel's built-in Chromium
    const browser = await puppeteer.launch({
      executablePath: "/usr/bin/google-chrome-stable",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
      headless: true,
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });

    // Configure header and footer templates
    const headerTemplate = header
      ? `
        <div style="font-size:10px; text-align:center; width:100%;">
          ${header}
        </div>
      `
      : ""; // Empty if header is not required

    const footerTemplate = footer || pageNumbers
      ? `
        <div style="font-size:10px; text-align:center; width:100%; margin-top:10px;">
          ${footer ? footer + " | " : ""}${
          pageNumbers
            ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'
            : ""
        }
        </div>
      `
      : ""; // Empty if footer and page numbers are not required

    // Generate PDF
    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "1in",
        right: "1in",
        bottom: "1in",
        left: "1in",
      },
      displayHeaderFooter: !!header || !!footer || !!pageNumbers,
      headerTemplate,
      footerTemplate,
    });

    await browser.close();

    // Return the PDF as a response
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${new URL(url).hostname}.pdf"`,
      },
    });
  } catch (error) {
    console.error("PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF", details: error.message },
      { status: 500 }
    );
  }
}
