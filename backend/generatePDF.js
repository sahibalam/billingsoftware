// generatePDF.js - IMPROVED for exact preview matching
const PDFDocument = require('pdfkit');

function generateInvoicePDF(invoiceData) {
    return new Promise((resolve, reject) => {
        try {
            const doc = new PDFDocument({ 
                size: 'A4',
                margin: 20,
                bufferPages: true
            });
            
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });
            
            // Calculate totals
            let totalQty = 0;
            let totalAmount = 0;
            
            invoiceData.products.forEach(product => {
                const qty = parseFloat(product.quantity) || 0;
                const rate = parseFloat(product.rate) || 0;
                const amount = qty * rate;
                totalQty += qty;
                totalAmount += amount;
            });
            
            const cgstRate = parseFloat(invoiceData.cgstRate) || 2.5;
            const sgstRate = parseFloat(invoiceData.sgstRate) || 2.5;
            const cgstAmount = (totalAmount * cgstRate / 100);
            const sgstAmount = (totalAmount * sgstRate / 100);
            const taxTotal = cgstAmount + sgstAmount;
            const grandTotal = totalAmount + taxTotal;
            
            // Use Courier font to match preview section
            doc.registerFont('Courier', 'Courier');
            doc.registerFont('Courier-Bold', 'Courier-Bold');
            
            // Slightly smaller left margin so the table uses more horizontal space
            const startX = 10;
            // Match usable width to the new startX so we still stay within page bounds
            const pageWidth = 595 - startX * 2; // ~575
            let currentY = 20;
            
            // ===== TITLE =====
            doc.font('Courier-Bold')
               .fontSize(16)
               .text('# Tax Invoice', { align: 'center' });
            
            doc.moveDown(0.1);
            doc.font('Courier')
               .fontSize(10)
               .text('(ORIGINAL FOR RECIPIENT)', { align: 'center' });
            
            doc.moveDown(0.5);
            currentY = doc.y;
            
            // ===== BUSINESS INFO SECTION =====
            // Business info on left
            doc.font('Courier-Bold')
               .fontSize(11)
               .text('MUFIZ TRADERS', startX, currentY);
            
            doc.font('Courier')
               .fontSize(10);
            doc.text('K5/22/A', startX, currentY + 15);
            doc.text('NEW UTTAR CHAKMIR, FAKIR PARA ROAD', startX, currentY + 27);
            doc.text('West Bengal, 700142', startX, currentY + 39);
            doc.text('GSTIN/UIN: 19ACNPA7760L2Z2', startX, currentY + 51);
            doc.text('State Name : West Bengal, Code : 19', startX, currentY + 63);
            
            // Invoice details on right
            const rightStartX = 350;
            doc.font('Courier')
               .fontSize(10);
            doc.text('Invoice No.', rightStartX, currentY);
            doc.font('Courier-Bold')
               .text(`: ${invoiceData.invoiceNumber}`, rightStartX + 60, currentY);
            
            doc.font('Courier')
               .text('Dated', rightStartX, currentY + 15);
            doc.text(`: ${formatDate(invoiceData.invoiceDate)}`, rightStartX + 60, currentY + 15);
            
            doc.text('Delivery Note', rightStartX, currentY + 30);
            doc.text('Buyer\'s Order No.', rightStartX, currentY + 45);
            doc.text(`: ${invoiceData.orderNumber || ''}`, rightStartX + 60, currentY + 45);
            
            doc.text('Dated', rightStartX, currentY + 60);
            doc.text(`: ${formatDate(invoiceData.orderDate) || ''}`, rightStartX + 60, currentY + 60);
            
            doc.text('Model/Terms of Payment', rightStartX, currentY + 75);
            
            // Extra gap before Consignee section
            currentY += 95;
            
            // ===== CONSIGNEE SECTION =====
            // Draw border box
            doc.rect(startX, currentY, pageWidth, 80).stroke();
            
            // Title
            doc.font('Courier-Bold')
               .fontSize(10)
               .text('Consignee (Ship to)', startX + 5, currentY + 5);
            
            // Consignee details (left side)
            doc.font('Courier')
               .fontSize(9);
            doc.text(invoiceData.buyerName, startX + 5, currentY + 20);
            doc.text(invoiceData.buyerAddress, startX + 5, currentY + 32);
            doc.text(`KOLKATA-${invoiceData.buyerPincode}`, startX + 5, currentY + 44);
            doc.text(`GSTIN/UIN : ${invoiceData.buyerGSTIN}`, startX + 5, currentY + 56);
            doc.text('State Name : West Bengal, Code : 19', startX + 5, currentY + 68);
            
            // Dispatch details (right side)
            const dispatchX = startX + 250;
            doc.text('Dispatch Doc No.', dispatchX, currentY + 20);
            doc.text('Delivery Note Date', dispatchX, currentY + 32);
            doc.text('Dispatched through', dispatchX, currentY + 44);
            doc.text('Destination', dispatchX, currentY + 56);
            doc.text('Terms of Delivery', dispatchX, currentY + 68);
            
            // Extra gap before Buyer section
            currentY += 95;
            
            // ===== BUYER SECTION =====
            // Draw border box
            doc.rect(startX, currentY, pageWidth, 40).stroke();
            
            // Title
            doc.font('Courier-Bold')
               .fontSize(10)
               .text('Buyer (Bill to)', startX + 5, currentY + 5);
            
            // Buyer details
            doc.font('Courier')
               .fontSize(9);
            
            const buyerLineY = currentY + 20;
            doc.text(invoiceData.buyerName, startX + 5, buyerLineY);
            doc.text(invoiceData.buyerAddress, startX + 150, buyerLineY);
            doc.text(`KOLKATA-${invoiceData.buyerPincode}`, startX + 350, buyerLineY);
            
            // Second line for GST and state
            const secondLineY = currentY + 32;
            doc.text(`GSTIN/UIN : ${invoiceData.buyerGSTIN}`, startX + 5, secondLineY);
            doc.text('State Name : West Bengal, Code : 19', startX + 300, secondLineY);
            
            // Extra gap before Products table
            currentY += 55;
            
            // ===== PRODUCTS TABLE =====
            // Fixed column widths + explicit start positions so each field stays in its own column
            // These add up exactly to pageWidth (575)
            const colArray = [
                30,   // Sr.
                220,  // Description of Goods
                75,   // HSN/SAC
                70,   // Quantity
                70,   // Rate
                40,   // per
                70    // Amount
            ];

            // Precompute the X start of each column
            const colStarts = [];
            {
                let acc = startX;
                for (let i = 0; i < colArray.length; i++) {
                    colStarts.push(acc);
                    acc += colArray[i];
                }
            }

            // Table header with gray background
            doc.rect(startX, currentY, pageWidth, 20).fillAndStroke('#f0f0f0', '#000');
            
            const headers = ['Sr.', 'Description of Goods', 'HSN/SAC', 'Quantity', 'Rate', 'per', 'Amount'];
            
            // Header text
            doc.font('Courier-Bold')
               .fontSize(9)
               .fillColor('#000');

            headers.forEach((header, i) => {
                const colX = colStarts[i];
                const colW = colArray[i];
                let align = 'left';
                let textX = colX + 4;

                if (i === 0) { // Sr.
                    align = 'center';
                    textX = colX;
                } else if (i === 2 || i === 5) { // HSN/SAC, per
                    align = 'center';
                    textX = colX;
                } else if (i === 3 || i === 4 || i === 6) { // Quantity, Rate, Amount
                    align = 'right';
                    textX = colX;
                }

                doc.text(header, textX, currentY + 6, {
                    width: colW - 8,
                    align
                });
            });

            currentY += 20;

            // Product rows
            invoiceData.products.forEach((product, index) => {
                // Draw row border
                doc.rect(startX, currentY, pageWidth, 20).stroke();

                // Draw vertical lines between columns
                for (let i = 1; i < colStarts.length; i++) {
                    const lineX = colStarts[i];
                    doc.moveTo(lineX, currentY)
                       .lineTo(lineX, currentY + 20)
                       .stroke();
                }

                // Fill product data
                doc.font('Courier')
                   .fontSize(9)
                   .fillColor('#000');

                // 1. Sr. No. (strictly inside first column)
                doc.text(String(index + 1), colStarts[0] + 2, currentY + 6, {
                    width: colArray[0] - 4,
                    align: 'left'
                });

                // 2. Description
                const description = `${product.description} ${product.size || ''}`.trim();
                doc.text(description, colStarts[1] + 2, currentY + 6, {
                    width: colArray[1] - 4,
                    align: 'left'
                });

                // 3. HSN/SAC
                doc.text(String(product.hsn || ''), colStarts[2], currentY + 6, {
                    width: colArray[2],
                    align: 'center'
                });

                // 4. Quantity
                const qty = parseFloat(product.quantity).toFixed(2);
                doc.text(qty, colStarts[3], currentY + 6, {
                    width: colArray[3] - 4,
                    align: 'right'
                });

                // 5. Rate
                const rate = parseFloat(product.rate).toFixed(2);
                doc.text(rate, colStarts[4], currentY + 6, {
                    width: colArray[4] - 4,
                    align: 'right'
                });

                // 6. per
                doc.text('PRS', colStarts[5], currentY + 6, {
                    width: colArray[5],
                    align: 'center'
                });

                // 7. Amount
                const amount = (parseFloat(product.quantity) * parseFloat(product.rate)).toFixed(2);
                doc.text(amount, colStarts[6], currentY + 6, {
                    width: colArray[6] - 4,
                    align: 'right'
                });

                currentY += 20;
            });
            
            // Total row
            doc.rect(startX, currentY, pageWidth, 20).stroke();

            // Vertical lines for total row (reuse colStarts)
            for (let i = 1; i < colStarts.length; i++) {
                const lineX = colStarts[i];
                doc.moveTo(lineX, currentY)
                   .lineTo(lineX, currentY + 20)
                   .stroke();
            }

            // Total text
            doc.font('Courier-Bold')
               .fontSize(10);

            // "Total" in first column
            doc.text('Total', colStarts[0] + 2, currentY + 6, {
                width: colArray[0] - 4,
                align: 'left'
            });

            // Total quantity in Quantity column
            doc.text(`${totalQty.toFixed(2)} PRS`, colStarts[3], currentY + 6, {
                width: colArray[3] - 4,
                align: 'right'
            });

            // Total amount in Amount column
            doc.text(totalAmount.toFixed(2), colStarts[6], currentY + 6, {
                width: colArray[6] - 4,
                align: 'right'
            });
            
            currentY += 30;
            
            // ===== REST OF THE INVOICE ===== (slightly more space before this block)
            // (Keep the rest of your code the same as before...)
            // Amount in words, Tax, Declaration, Bank details, Signature
            
            doc.font('Courier')
               .fontSize(9)
               .text('Amount Chargeable (in words)', startX, currentY);
            
            doc.font('Courier-Bold')
               .fontSize(10);
            
            const amountWords = numberToWords(grandTotal);
            doc.text(`INR ${amountWords} Only`, startX + 180, currentY);
            
            // Slightly larger gap before the tax summary table to avoid any visual overlap
            currentY += 25;

            // ===== TAX SUMMARY TABLE (to match reference layout) =====
            const taxTableHeight = 16;

            // Column widths for: Taxable Value | CGST (2 sub-columns) | SGST (2 sub-columns) | Total Tax Amount
            const taxCols = [
                120, // Taxable Value
                80,  // CGST (Rate + Amount)
                80,  // SGST (Rate + Amount)
                pageWidth - (120 + 80 + 80) // Total Tax Amount
            ];

            const taxStarts = [];
            {
                let acc = startX;
                for (let i = 0; i < taxCols.length; i++) {
                    taxStarts.push(acc);
                    acc += taxCols[i];
                }
            }

            // Row 1: main headers
            doc.rect(startX, currentY, pageWidth, taxTableHeight).stroke();

            doc.font('Courier-Bold')
               .fontSize(9);

            doc.text('Taxable Value', taxStarts[0] + 2, currentY + 3, {
                width: taxCols[0] - 4,
                align: 'center'
            });
            doc.text('CGST', taxStarts[1] + 2, currentY + 3, {
                width: taxCols[1] - 4,
                align: 'center'
            });
            doc.text('SGST/UTGST', taxStarts[2] + 2, currentY + 3, {
                width: taxCols[2] - 4,
                align: 'center'
            });
            doc.text('Total Tax Amount', taxStarts[3] + 2, currentY + 3, {
                width: taxCols[3] - 4,
                align: 'center'
            });

            // Vertical lines (between main columns)
            for (let i = 1; i < taxStarts.length; i++) {
                const lineX = taxStarts[i];
                doc.moveTo(lineX, currentY)
                   .lineTo(lineX, currentY + taxTableHeight)
                   .stroke();
            }

            currentY += taxTableHeight;

            // Row 2: subheaders Rate / Amount for CGST and SGST
            doc.rect(startX, currentY, pageWidth, taxTableHeight).stroke();

            doc.font('Courier')
               .fontSize(9);

            // Subcell vertical lines for CGST and SGST (split each into Rate/Amount)
            const cgstMid = taxStarts[1] + taxCols[1] / 2;
            const sgstMid = taxStarts[2] + taxCols[2] / 2;

            doc.moveTo(cgstMid, currentY)
               .lineTo(cgstMid, currentY + taxTableHeight)
               .stroke();
            doc.moveTo(sgstMid, currentY)
               .lineTo(sgstMid, currentY + taxTableHeight)
               .stroke();

            // Labels
            doc.text('Rate', cgstMid - taxCols[1] / 2 + 2, currentY + 3, {
                width: taxCols[1] / 2 - 4,
                align: 'left'
            });
            doc.text('Amount', cgstMid + 2, currentY + 3, {
                width: taxCols[1] / 2 - 4,
                align: 'left'
            });

            doc.text('Rate', sgstMid - taxCols[2] / 2 + 2, currentY + 3, {
                width: taxCols[2] / 2 - 4,
                align: 'left'
            });
            doc.text('Amount', sgstMid + 2, currentY + 3, {
                width: taxCols[2] / 2 - 4,
                align: 'left'
            });

            currentY += taxTableHeight;

            // Row 3: numeric values
            doc.rect(startX, currentY, pageWidth, taxTableHeight).stroke();

            // Redraw main vertical lines and sublines for the data row
            for (let i = 1; i < taxStarts.length; i++) {
                const lineX = taxStarts[i];
                doc.moveTo(lineX, currentY)
                   .lineTo(lineX, currentY + taxTableHeight)
                   .stroke();
            }
            doc.moveTo(cgstMid, currentY)
               .lineTo(cgstMid, currentY + taxTableHeight)
               .stroke();
            doc.moveTo(sgstMid, currentY)
               .lineTo(sgstMid, currentY + taxTableHeight)
               .stroke();

            const totalTax = taxTotal.toFixed(2);

            doc.font('Courier')
               .fontSize(9);

            doc.text(totalAmount.toFixed(2), taxStarts[0] + 2, currentY + 3, {
                width: taxCols[0] - 4,
                align: 'right'
            });

            doc.text(`${cgstRate}%`, cgstMid - taxCols[1] / 2 + 2, currentY + 3, {
                width: taxCols[1] / 2 - 4,
                align: 'right'
            });
            doc.text(cgstAmount.toFixed(2), cgstMid + 2, currentY + 3, {
                width: taxCols[1] / 2 - 4,
                align: 'right'
            });

            doc.text(`${sgstRate}%`, sgstMid - taxCols[2] / 2 + 2, currentY + 3, {
                width: taxCols[2] / 2 - 4,
                align: 'right'
            });
            doc.text(sgstAmount.toFixed(2), sgstMid + 2, currentY + 3, {
                width: taxCols[2] / 2 - 4,
                align: 'right'
            });

            doc.text(totalTax, taxStarts[3] + 2, currentY + 3, {
                width: taxCols[3] - 4,
                align: 'right'
            });

            currentY += taxTableHeight + 10;

            // Tax Amount (in words) line
            doc.font('Courier')
               .fontSize(9)
               .text('Tax Amount (in words) :', startX, currentY);

            doc.font('Courier-Bold')
               .fontSize(10);

            const taxWords = numberToWords(taxTotal);
            doc.text(`INR ${taxWords} Only`, startX + 180, currentY);

            currentY += 25;
            
            // Declaration
            doc.font('Courier-Bold')
               .fontSize(10)
               .text('Declaration', startX, currentY);

            // Add clear padding below the heading before the paragraph text
            const declarationTextY = currentY + 14;

            doc.font('Courier')
               .fontSize(9)
               .text('We declare that this invoice shows the actual price of the goods', startX, declarationTextY);
            
            doc.text('described and that all particulars are true and correct.', startX, declarationTextY + 12);
            
            currentY += 35;
            
            // Bank details
            doc.rect(startX, currentY, pageWidth, 50).stroke();
            
            doc.font('Courier-Bold')
               .fontSize(10)
               .text('Company\'s Bank Details', startX + 5, currentY + 5);
            
            doc.font('Courier')
               .fontSize(9);
            doc.text('A/c Holder\'s Name : MUFIZ TRADERS', startX + 5, currentY + 20);
            doc.text('Bank Name : PUNJAB NATIONAL BANK', startX + 5, currentY + 32);
            doc.text('A/c No. : 0339250006928', startX + 300, currentY + 20);
            doc.text('Branch & IFS Code : PUNB0140600', startX + 300, currentY + 32);
            
            currentY += 65;
            
            // Signature
            doc.moveTo(startX, currentY)
               .lineTo(startX + 200, currentY)
               .stroke();
            
            doc.font('Courier')
               .fontSize(9)
               .text('Customer\'s Seal and Signature', startX + 5, currentY + 5);
            
            doc.moveTo(startX + 350, currentY)
               .lineTo(startX + 550, currentY)
               .stroke();
            
            doc.text('for MUFIZ TRADERS', startX + 355, currentY + 5);
            
            currentY += 25;
            
            doc.font('Courier')
               .fontSize(9)
               .text('Authorised Signatory', { align: 'right' });
            
            currentY += 20;

            // If there is still a lot of space left on the page, gently push the footer text
            // down so we visually use more of the page height.
            if (currentY < 730) {
                currentY = 730;
            }
            
            doc.font('Courier')
               .fontSize(8)
               .text('This is a Computer Generated Invoice', { align: 'center' });
            
            doc.end();
            
        } catch (error) {
            console.error('Error in generateInvoicePDF:', error);
            reject(error);
        }
    });
}

// (Keep the helper functions the same...)
function formatDate(dateString) {
    if (!dateString) return '';
    try {
        const date = new Date(dateString);
        const day = date.getDate().toString().padStart(2, '0');
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const year = date.getFullYear().toString().slice(-2);
        return `${day}-${month}-${year}`;
    } catch (error) {
        return dateString;
    }
}

function numberToWords(num) {
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    
    if (num === 0) return 'Zero';
    
    let words = '';
    let n = Math.floor(num);
    
    const paise = Math.round((num - n) * 100);
    
    if (n >= 10000000) {
        words += numberToWords(Math.floor(n / 10000000)) + ' Crore ';
        n %= 10000000;
    }
    
    if (n >= 100000) {
        words += numberToWords(Math.floor(n / 100000)) + ' Lakh ';
        n %= 100000;
    }
    
    if (n >= 1000) {
        words += numberToWords(Math.floor(n / 1000)) + ' Thousand ';
        n %= 1000;
    }
    
    if (n >= 100) {
        words += numberToWords(Math.floor(n / 100)) + ' Hundred ';
        n %= 100;
    }
    
    if (n > 0) {
        if (n < 10) {
            words += ones[n];
        } else if (n < 20) {
            words += teens[n - 10];
        } else {
            words += tens[Math.floor(n / 10)];
            if (n % 10 > 0) {
                words += ' ' + ones[n % 10];
            }
        }
    }
    
    if (paise > 0) {
        words += ' and ' + numberToWords(paise) + ' Paise';
    }
    
    return words.trim() + ' Rupees';
}

module.exports = { generateInvoicePDF };