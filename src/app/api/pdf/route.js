/**
 * File Name: route.js
 * Author(s): Senthilnathan Karuppaiah and ChatGPT :-)
 * Date: 14-Mar-2024
 * 
 * Description: This API endpoint leverages Puppeteer to generate PDFs dynamically 
 * from given URLs. It supports optional headers, footers, and page numbering while 
 * adapting for both local and production environments. Designed to be lightweight, 
 * it switches between full Puppeteer (local testing) and Puppeteer-Core with 
 * @sparticuz/chromium (production). The endpoint is optimized for serverless 
 * platforms like Vercel and is part of a microservice supporting TemplrJS.
 * 
 * Credit: The integration approach for Puppeteer in serverless environments is inspired 
 * by the article "Use Puppeteer on AWS Lambdas" by The Bilt Theory (https://www.thebiltheory.com/blog/use-puppeteer-on-aws-lambdas).
 */

import puppeteerCore from "puppeteer-core";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium";
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

  if (!url || !isValidUrl(url)) {
    return NextResponse.json(
      { error: "Invalid or missing 'url' parameter" },
      { status: 400 }
    );
  }

  try {
    let browser;

    // Switch between local and production environments
    if (process.env.NODE_ENV === "development") {
      // Use Puppeteer locally
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });
    } else {
      // Use Puppeteer-Core with @sparticuz/chromium in production
      browser = await puppeteerCore.launch({
        args: chromium.args,
        executablePath: await chromium.executablePath(),
        headless: chromium.headless,
      });
    }

    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle0" });

    const headerTemplate = header
      ? `<div style="width: 100%; text-align: center; font-size: 10px;">${header}</div>`
      : "<span></span>";

    const footerTemplate = footer || pageNumbers
      ? `<div style="width: 100%; text-align: center; font-size: 10px;">
            ${footer ? footer + " | " : ""}
            ${pageNumbers ? 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>' : ""}
         </div>`
      : "<span></span>";

    const pdfBuffer = await page.pdf({
      format: "A4",
      margin: {
        top: "1in",
        right: "0.5in",
        bottom: "1in",
        left: "0.5in",
      },
      displayHeaderFooter: !!header || !!footer || !!pageNumbers,
      headerTemplate,
      footerTemplate,
      printBackground: true,
    });

    // Extract the last part of the URL path and generate the filename
    const routePath = new URL(url).pathname;
    const lastPart = routePath.split('/').filter(Boolean).pop();
    const timestamp = Math.floor(Date.now() / 1000);
    const filename = lastPart ? `${lastPart}-${timestamp}.pdf` : `file-${timestamp}.pdf`;

    await browser.close();

    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
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
