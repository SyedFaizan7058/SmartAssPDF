import sys
import os
import subprocess
import argparse
import fitz # PyMuPDF
import docx
from docx.shared import Inches, Pt
from docx.enum.section import WD_SECTION
from docx.enum.text import WD_ALIGN_PARAGRAPH
from PIL import Image
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side

SOFFICE_PATHS = [
    r"C:\Program Files\LibreOffice\program\soffice.com",
    r"C:\Program Files\LibreOffice\program\soffice.exe",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.com",
    r"C:\Program Files (x86)\LibreOffice\program\soffice.exe",
    "soffice",
    "libreoffice"
]

def find_soffice():
    for p in SOFFICE_PATHS:
        if os.path.exists(p):
            return p
    try:
        r = subprocess.run(["where", "soffice"], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return r.stdout.strip().splitlines()[0]
    except Exception:
        pass
    return "soffice"

def convert_pdf_to_word(input_pdf, output_docx):
    """
    Converts PDF into a 100% fully editable Microsoft Word (.docx) document:
    - Primary engine: pdf2docx (reconstructs native editable text blocks, fonts, colors, paragraphs, and tables)
    - Fallback engine: PyMuPDF structured text, font hierarchy, native Word tables, and embedded images
    """
    out_dir = os.path.dirname(os.path.abspath(output_docx))
    if out_dir and not os.path.exists(out_dir):
        os.makedirs(out_dir, exist_ok=True)
        
    try:
        from pdf2docx import Converter
        cv = Converter(input_pdf)
        cv.convert(output_docx, start=0, end=None)
        cv.close()
        if os.path.exists(output_docx) and os.path.getsize(output_docx) > 1000:
            print(f"Successfully converted {input_pdf} -> {output_docx} (Editable Word via pdf2docx)")
            return
    except Exception as e:
        print(f"pdf2docx conversion note: {e}, using PyMuPDF structured text fallback...")

    # Fallback: Structured text, native tables, and embedded images with python-docx
    doc = fitz.open(input_pdf)
    wdoc = docx.Document()
    
    for p_idx, page in enumerate(doc):
        if p_idx > 0:
            wdoc.add_page_break()
            
        # Extract tables if any
        table_bboxes = []
        try:
            tabs = page.find_tables()
            for tab in tabs:
                t_bbox = tab.bbox
                table_bboxes.append(t_bbox)
                data = tab.extract()
                if data and len(data) > 0:
                    cols = len(data[0])
                    table = wdoc.add_table(rows=len(data), cols=cols)
                    table.style = 'Table Grid'
                    for r_i, row in enumerate(data):
                        for c_i, val in enumerate(row):
                            if c_i < cols:
                                table.cell(r_i, c_i).text = str(val or "").strip()
        except Exception:
            pass

        # Extract text blocks
        blocks = page.get_text("blocks")
        for b in blocks:
            if len(b) >= 7 and b[6] == 0: # text block
                text = b[4].strip()
                if not text:
                    continue
                inside_table = False
                bx0, by0, bx1, by1 = b[0], b[1], b[2], b[3]
                for tb in table_bboxes:
                    if bx0 >= tb[0]-5 and by0 >= tb[1]-5 and bx1 <= tb[2]+5 and by1 <= tb[3]+5:
                        inside_table = True
                        break
                if not inside_table:
                    p = wdoc.add_paragraph()
                    p.add_run(text)
            elif len(b) >= 7 and b[6] == 1: # image block
                try:
                    pix = page.get_pixmap(clip=fitz.Rect(b[0], b[1], b[2], b[3]))
                    img_path = os.path.join(out_dir, f"temp_img_{p_idx}_{b[5]}.png")
                    pix.save(img_path)
                    wdoc.add_picture(img_path, width=Inches(min(6.0, (b[2] - b[0]) / 72.0)))
                    if os.path.exists(img_path):
                        os.remove(img_path)
                except Exception:
                    pass

    wdoc.save(output_docx)
    print(f"Successfully converted {input_pdf} -> {output_docx} (Editable Word via Structured PyMuPDF)")

def convert_word_to_pdf(input_docx, output_pdf):
    soffice = find_soffice()
    out_dir = os.path.dirname(os.path.abspath(output_pdf))
    cmd = [soffice, "--headless", "--convert-to", "pdf", "--outdir", out_dir, input_docx]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice Word to PDF failed: {res.stderr}")
    
    base = os.path.splitext(os.path.basename(input_docx))[0]
    generated_pdf = os.path.join(out_dir, base + ".pdf")
    if generated_pdf != os.path.abspath(output_pdf) and os.path.exists(generated_pdf):
        if os.path.exists(output_pdf):
            os.remove(output_pdf)
        os.rename(generated_pdf, output_pdf)
    print(f"Successfully converted {input_docx} -> {output_pdf}")

def convert_excel_to_pdf(input_xlsx, output_pdf):
    soffice = find_soffice()
    out_dir = os.path.dirname(os.path.abspath(output_pdf))
    cmd = [soffice, "--headless", "--convert-to", "pdf:calc_pdf_Export", "--outdir", out_dir, input_xlsx]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice Excel to PDF failed: {res.stderr}")
    
    base = os.path.splitext(os.path.basename(input_xlsx))[0]
    generated_pdf = os.path.join(out_dir, base + ".pdf")
    if generated_pdf != os.path.abspath(output_pdf) and os.path.exists(generated_pdf):
        if os.path.exists(output_pdf):
            os.remove(output_pdf)
        os.rename(generated_pdf, output_pdf)
    print(f"Successfully converted {input_xlsx} -> {output_pdf}")

def convert_html_to_pdf(input_html, output_pdf):
    soffice = find_soffice()
    out_dir = os.path.dirname(os.path.abspath(output_pdf))
    cmd = [soffice, "--headless", "--convert-to", "pdf", "--outdir", out_dir, input_html]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"LibreOffice HTML to PDF failed: {res.stderr}")
    
    base = os.path.splitext(os.path.basename(input_html))[0]
    generated_pdf = os.path.join(out_dir, base + ".pdf")
    if generated_pdf != os.path.abspath(output_pdf) and os.path.exists(generated_pdf):
        if os.path.exists(output_pdf):
            os.remove(output_pdf)
        os.rename(generated_pdf, output_pdf)
    print(f"Successfully converted {input_html} -> {output_pdf}")

def convert_pdf_to_excel(input_pdf, output_xlsx):
    """
    Optimized PDF to Excel (XLSX) Extractor:
    Parses structured tables, multi-column text, numeric cells, and headers
    with auto-adjusted column widths and styling.
    """
    doc = fitz.open(input_pdf)
    wb = openpyxl.Workbook()
    
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_font = Font(name="Arial", size=10, bold=True, color="FFFFFF")
    data_font = Font(name="Arial", size=10)
    thin_border = Border(
        left=Side(style='thin', color='E2E8F0'),
        right=Side(style='thin', color='E2E8F0'),
        top=Side(style='thin', color='E2E8F0'),
        bottom=Side(style='thin', color='E2E8F0')
    )
    
    sheets_created = 0
    
    try:
        import tabula
        import pandas as pd
        dfs = tabula.read_pdf(input_pdf, pages="all", multiple_tables=True, lattice=False, stream=True)
        if not dfs or len(dfs) == 0:
            dfs = tabula.read_pdf(input_pdf, pages="all", multiple_tables=True, lattice=True)
            
        if dfs and len(dfs) > 0 and sum(len(df) for df in dfs) > 0:
            for t_idx, df in enumerate(dfs):
                if df.empty:
                    continue
                sheet_title = f"Table {t_idx+1}"[:31]
                ws = wb.active if sheets_created == 0 else wb.create_sheet(title=sheet_title)
                sheets_created += 1
                
                for col_idx, col_name in enumerate(df.columns, 1):
                    cell = ws.cell(row=1, column=col_idx, value=str(col_name))
                    cell.font = header_font
                    cell.fill = header_fill
                    cell.alignment = Alignment(horizontal="center", vertical="center")
                    cell.border = thin_border
                
                for row_idx, row_vals in enumerate(df.values, 2):
                    for col_idx, val in enumerate(row_vals, 1):
                        cell_val = val
                        if pd.notna(val):
                            s_val = str(val).strip().replace(",", "")
                            try:
                                if "." in s_val:
                                    cell_val = float(s_val)
                                else:
                                    cell_val = int(s_val)
                            except ValueError:
                                cell_val = str(val)
                        else:
                            cell_val = ""
                            
                        cell = ws.cell(row=row_idx, column=col_idx, value=cell_val)
                        cell.font = data_font
                        cell.border = thin_border
                        if isinstance(cell_val, (int, float)):
                            cell.alignment = Alignment(horizontal="right", vertical="center")
                        else:
                            cell.alignment = Alignment(horizontal="left", vertical="center")
                
                for col in ws.columns:
                    max_len = max(len(str(c.value or '')) for c in col)
                    col_letter = openpyxl.utils.get_column_letter(col[0].column)
                    ws.column_dimensions[col_letter].width = max(12, min(50, max_len + 3))
            
            if sheets_created > 0:
                wb.save(output_xlsx)
                print(f"Optimized Tabula Excel saved: {output_xlsx}")
                return
    except Exception as e:
        print(f"Tabula note: {e}")

    for p_idx, page in enumerate(doc):
        ws = wb.active if sheets_created == 0 else wb.create_sheet(title=f"Page {p_idx+1}"[:31])
        sheets_created += 1
        
        tables = page.find_tables()
        row_num = 1
        
        if tables and len(tables.tables) > 0:
            for tab in tables:
                data = tab.extract()
                if not data:
                    continue
                for r_idx, r_data in enumerate(data):
                    for c_idx, val in enumerate(r_data, 1):
                        cell_val = val or ""
                        s_val = str(cell_val).strip().replace(",", "")
                        try:
                            if "." in s_val:
                                cell_val = float(s_val)
                            else:
                                cell_val = int(s_val)
                        except ValueError:
                            pass
                            
                        cell = ws.cell(row=row_num, column=c_idx, value=cell_val)
                        cell.font = header_font if r_idx == 0 else data_font
                        if r_idx == 0:
                            cell.fill = header_fill
                        cell.border = thin_border
                    row_num += 1
                row_num += 1
        else:
            text_page = page.get_text("dict")
            lines = []
            for b in text_page.get("blocks", []):
                if b.get("type") == 0:
                    for l in b.get("lines", []):
                        spans = l.get("spans", [])
                        if not spans:
                            continue
                        line_text = "".join(s["text"] for s in spans).strip()
                        if line_text:
                            lines.append(line_text)
            
            for l in lines:
                parts = [p.strip() for p in l.split("  ") if p.strip()]
                if not parts:
                    continue
                for c_idx, val in enumerate(parts, 1):
                    cell = ws.cell(row=row_num, column=c_idx, value=val)
                    cell.font = data_font
                    cell.border = thin_border
                row_num += 1
                
        for col in ws.columns:
            max_len = max((len(str(c.value or '')) for c in col), default=10)
            col_letter = openpyxl.utils.get_column_letter(col[0].column)
            ws.column_dimensions[col_letter].width = max(12, min(50, max_len + 3))

    wb.save(output_xlsx)
    print(f"Optimized Excel generated: {output_xlsx}")

def convert_image_to_webp(input_image, output_webp, quality=85):
    """
    Converts JPG, JPEG, and PNG images into modern compressed WebP.
    """
    im = Image.open(input_image)
    q = int(float(quality) * 100) if float(quality) <= 1.0 else int(quality)
    q = max(1, min(100, q))
    
    if im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info):
        im.save(output_webp, "WEBP", quality=q, method=6)
    else:
        im_rgb = im.convert("RGB")
        im_rgb.save(output_webp, "WEBP", quality=q, method=6)
    print(f"Successfully converted {input_image} -> {output_webp} (Quality: {q})")

def compress_pdf_advanced(input_path, output_path, quality=0.5):
    """
    Multi-Stage PDF Compression Engine:
    1. PyMuPDF + Pillow Image Resampling (DPI-aware & format-optimized)
    2. PyMuPDF Garbage Collection (garbage=4) & Flate Deflation
    3. pypdf Content Stream Compression & Identical Object Deduplication
    4. Best-size selector
    """
    import io
    orig_size = os.path.getsize(input_path)
    q = float(quality) if quality is not None else 0.5
    if q > 1.0:
        q = q / 100.0
    
    if q <= 0.35: # Extreme
        max_dim = 800
        jpg_quality = 45
        flatten_alpha = True
    elif q <= 0.65: # Balanced
        max_dim = 1300
        jpg_quality = 65
        flatten_alpha = False
    else: # High Quality
        max_dim = 1800
        jpg_quality = 80
        flatten_alpha = False

    temp_stage1 = output_path + ".stage1.pdf"
    temp_stage2 = output_path + ".stage2.pdf"
    
    try:
        # --- STAGE 1: PyMuPDF Image Extraction & Resampling ---
        doc = fitz.open(input_path)
        processed_xrefs = set()
        
        try:
            doc.set_metadata({})
        except Exception:
            pass

        for page_idx in range(len(doc)):
            page = doc[page_idx]
            image_list = page.get_images(full=True)
            
            for img_info in image_list:
                xref = img_info[0]
                if xref in processed_xrefs:
                    continue
                processed_xrefs.add(xref)
                
                try:
                    base_image = doc.extract_image(xref)
                    if not base_image:
                        continue
                    
                    image_bytes = base_image.get("image")
                    if not image_bytes:
                        continue
                    
                    img = Image.open(io.BytesIO(image_bytes))
                    orig_w, orig_h = img.size
                    
                    scale = 1.0
                    if orig_w > max_dim or orig_h > max_dim:
                        scale = min(max_dim / orig_w, max_dim / orig_h)
                    
                    new_w = max(1, int(orig_w * scale))
                    new_h = max(1, int(orig_h * scale))
                    
                    if new_w < orig_w or new_h < orig_h:
                        img = img.resize((new_w, new_h), Image.Resampling.LANCZOS)
                    
                    out_io = io.BytesIO()
                    if img.mode in ("RGBA", "LA") or (img.mode == "P" and "transparency" in img.info):
                        if flatten_alpha:
                            bg = Image.new("RGB", img.size, (255, 255, 255))
                            if img.mode == "RGBA":
                                bg.paste(img, mask=img.split()[-1])
                            else:
                                bg.paste(img)
                            bg.save(out_io, format="JPEG", quality=jpg_quality, optimize=True)
                        else:
                            img.save(out_io, format="PNG", optimize=True)
                    else:
                        if img.mode != "RGB":
                            img = img.convert("RGB")
                        img.save(out_io, format="JPEG", quality=jpg_quality, optimize=True)
                    
                    compressed_bytes = out_io.getvalue()
                    
                    if len(compressed_bytes) < len(image_bytes):
                        doc.update_stream(xref, compressed_bytes)
                except Exception:
                    continue

        doc.save(
            temp_stage1,
            garbage=4,
            deflate=True,
            deflate_images=True,
            deflate_fonts=True,
            clean=True
        )
        doc.close()
    except Exception as e:
        temp_stage1 = input_path

    # --- STAGE 2: pypdf Stream Compression & Deduplication ---
    try:
        import pypdf
        reader = pypdf.PdfReader(temp_stage1)
        writer = pypdf.PdfWriter()
        
        for page in reader.pages:
            try:
                page.compress_content_streams()
            except Exception:
                pass
            writer.add_page(page)
        
        try:
            writer.compress_identical_objects()
        except Exception:
            pass
        
        with open(temp_stage2, "wb") as f_out:
            writer.write(f_out)
    except Exception as e:
        temp_stage2 = temp_stage1

    # --- STAGE 3: Compare & Pick Best ---
    candidates = [input_path]
    if os.path.exists(temp_stage1) and os.path.getsize(temp_stage1) > 0:
        candidates.append(temp_stage1)
    if os.path.exists(temp_stage2) and os.path.getsize(temp_stage2) > 0:
        candidates.append(temp_stage2)
    
    best_candidate = min(candidates, key=os.path.getsize)
    
    if best_candidate != output_path:
        with open(best_candidate, "rb") as f_src, open(output_path, "wb") as f_dst:
            f_dst.write(f_src.read())
    
    for tmp in [temp_stage1, temp_stage2]:
        if os.path.exists(tmp) and tmp != output_path and tmp != input_path:
            try:
                os.remove(tmp)
            except Exception:
                pass

    new_size = os.path.getsize(output_path)
    savings = (1 - (new_size / orig_size)) * 100 if orig_size > 0 else 0
    print(f"Compressed {os.path.basename(input_path)}: {orig_size:,} -> {new_size:,} bytes ({savings:.1f}% reduction)")
    return output_path

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["pdf-to-word", "word-to-pdf", "excel-to-pdf", "pdf-to-excel", "html-to-pdf", "image-to-webp", "compress-pdf"])
    parser.add_argument("input")
    parser.add_argument("output")
    parser.add_argument("--quality", default=85, type=float)
    args = parser.parse_args()

    if args.mode == "pdf-to-word":
        convert_pdf_to_word(args.input, args.output)
    elif args.mode == "word-to-pdf":
        convert_word_to_pdf(args.input, args.output)
    elif args.mode == "excel-to-pdf":
        convert_excel_to_pdf(args.input, args.output)
    elif args.mode == "pdf-to-excel":
        convert_pdf_to_excel(args.input, args.output)
    elif args.mode == "html-to-pdf":
        convert_html_to_pdf(args.input, args.output)
    elif args.mode == "image-to-webp":
        convert_image_to_webp(args.input, args.output, args.quality)
    elif args.mode == "compress-pdf":
        compress_pdf_advanced(args.input, args.output, args.quality)
