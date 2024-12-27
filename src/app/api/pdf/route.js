import puppeteer from "puppeteer";
import { NextResponse } from "next/server";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");
  const header = searchParams.get("header");
  const footer = searchParams.get("footer");
  const pageNumbers = searchParams.get("pageNumbers") === "true";

  if (!url) {
    return NextResponse.json(
      { error: "Invalid or missing 'url' parameter" },
      { status: 400 }
    );
  }

  try {
    const browser = await puppeteer.launch({
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--single-process",
        "--no-zygote",
      ],
      headless: true,
      executablePath: "/tmp/chromium",
      env: {
        PUPPETEER_CACHE_DIR: "/tmp",
      },
    });

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });

    const headerTemplate = header
      ? `<div style="font-size:10px; text-align:center;">${header}</div>`
      : "<span></span>";

    const footerTemplate = footer || pageNumbers
      ? `<div style="font-size:10px; text-align:center;">${
          footer ? footer + " | " : ""
        }${
          pageNumbers
            ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>'
            : ""
        }</div>`
      : "<span></span>";

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: header ? "1in" : "0.5in",
        right: "0.5in",
        bottom: footer || pageNumbers ? "1in" : "0.5in",
        left: "0.5in",
      },
      displayHeaderFooter: !!header || !!footer || !!pageNumbers,
      headerTemplate,
      footerTemplate,
      printBackground: true,
    });

    await browser.close();

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
