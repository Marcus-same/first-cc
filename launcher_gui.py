"""
简历匹配工具 - 桌面启动器（tkinter GUI）
双击运行，无需命令行。
"""
import subprocess
import sys
import os
import tkinter as tk
from tkinter import filedialog, messagebox, ttk

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SCRIPT = os.path.join(os.path.dirname(__file__), "jd_matcher.py")
REPORTS_DIR = os.path.join(os.path.dirname(__file__), "match_reports")
PYTHON = sys.executable


def run_cmd(*args):
    """运行 jd_matcher.py 命令，返回输出"""
    cmd = [PYTHON, SCRIPT] + list(args)
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=300,
            encoding="utf-8", errors="replace",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"}
        )
        return result.stdout + result.stderr
    except subprocess.TimeoutExpired:
        return "[错误] 操作超时（AI 评分可能需要较长时间，请重试）"
    except Exception as e:
        return f"[错误] {e}"


class App:
    def __init__(self, root):
        self.root = root
        root.title("简历-JD 智能匹配打分工具")
        root.geometry("520x520")
        root.resizable(False, False)

        # 标题
        title = tk.Label(root, text="简历-JD 智能匹配打分", font=("Microsoft YaHei", 16, "bold"))
        title.pack(pady=(20, 5))

        subtitle = tk.Label(root, text="上传 JD → 匹配简历 → AI 评分", font=("Microsoft YaHei", 9), fg="#666")
        subtitle.pack(pady=(0, 20))

        # 按钮区域
        btn_frame = tk.Frame(root)
        btn_frame.pack(pady=10)

        tk.Button(btn_frame, text="录入新岗位 JD", width=28, height=2,
                  command=self.add_jd, bg="#4A90D9", fg="white",
                  font=("Microsoft YaHei", 10)).pack(pady=4)

        tk.Button(btn_frame, text="查看已录入岗位", width=28, height=2,
                  command=self.list_jd, font=("Microsoft YaHei", 10)).pack(pady=4)

        tk.Button(btn_frame, text="单份简历打分", width=28, height=2,
                  command=self.score_one, bg="#5CB85C", fg="white",
                  font=("Microsoft YaHei", 10)).pack(pady=4)

        tk.Button(btn_frame, text="批量处理（整个文件夹）", width=28, height=2,
                  command=self.match_folder, bg="#F0AD4E", fg="white",
                  font=("Microsoft YaHei", 10)).pack(pady=4)

        tk.Button(btn_frame, text="删除岗位", width=28, height=2,
                  command=self.remove_jd, fg="#D9534F",
                  font=("Microsoft YaHei", 10)).pack(pady=4)

        tk.Button(btn_frame, text="打开评分报告文件夹", width=28, height=2,
                  command=self.open_reports, font=("Microsoft YaHei", 10)).pack(pady=4)

        # 输出区域
        output_label = tk.Label(root, text="运行日志", font=("Microsoft YaHei", 9), fg="#999")
        output_label.pack(pady=(15, 2))

        self.output = tk.Text(root, height=8, width=60, font=("Consolas", 9), bg="#1e1e1e", fg="#d4d4d4")
        self.output.pack(pady=(0, 10), padx=20)
        self.output.insert("1.0", "就绪。点击上方按钮开始操作。\n")

    def log(self, text):
        self.output.insert("end", text + "\n")
        self.output.see("end")
        self.root.update()

    def add_jd(self):
        dialog = tk.Toplevel(self.root)
        dialog.title("录入新岗位 JD")
        dialog.geometry("500x400")

        tk.Label(dialog, text="岗位名称:", font=("Microsoft YaHei", 10)).pack(pady=(10, 2))
        title_entry = tk.Entry(dialog, width=50, font=("Microsoft YaHei", 10))
        title_entry.pack(pady=(0, 10))

        tk.Label(dialog, text="JD 内容:", font=("Microsoft YaHei", 10)).pack(pady=(0, 2))
        jd_text = tk.Text(dialog, height=15, width=55, font=("Microsoft YaHei", 10))
        jd_text.pack(pady=(0, 10))

        def save():
            title = title_entry.get().strip()
            content = jd_text.get("1.0", "end").strip()
            if not title:
                messagebox.showwarning("提示", "请输入岗位名称")
                return
            if not content:
                messagebox.showwarning("提示", "请输入 JD 内容")
                return

            # 写入临时文件
            import tempfile
            with tempfile.NamedTemporaryFile(mode="w", suffix=".txt", delete=False, encoding="utf-8") as f:
                f.write(content)
                tmp_path = f.name

            output = run_cmd("--add-jd", title, "--jd-file", tmp_path)
            os.unlink(tmp_path)
            self.log(output)
            dialog.destroy()
            messagebox.showinfo("完成", f"岗位「{title}」已保存")

        tk.Button(dialog, text="保存", command=save, width=15, height=2,
                  bg="#4A90D9", fg="white", font=("Microsoft YaHei", 10)).pack()

    def list_jd(self):
        output = run_cmd("--list-jd")
        self.log(output)

    def score_one(self):
        file_path = filedialog.askopenfilename(
            title="选择简历文件",
            filetypes=[("简历文件", "*.pdf *.docx *.doc *.txt *.md"), ("所有文件", "*.*")]
        )
        if not file_path:
            return

        self.log(f"正在评分: {os.path.basename(file_path)}")
        self.log("AI 分析中，请稍候（最长 3 分钟）...")
        output = run_cmd("--score", file_path)
        self.log(output)

    def match_folder(self):
        folder_path = filedialog.askdirectory(title="选择简历文件夹")
        if not folder_path:
            return

        export_csv = messagebox.askyesno("导出 CSV", "是否同时导出 CSV 汇总表？")
        self.log(f"批量处理: {folder_path}")
        self.log("AI 分析中，请稍候...")

        if export_csv:
            output = run_cmd("--match", folder_path, "--output", "csv")
        else:
            output = run_cmd("--match", folder_path)
        self.log(output)

    def remove_jd(self):
        output = run_cmd("--list-jd")
        self.log(output)

        dialog = tk.Toplevel(self.root)
        dialog.title("删除岗位")
        dialog.geometry("350x150")

        tk.Label(dialog, text="输入要删除的岗位名:", font=("Microsoft YaHei", 10)).pack(pady=(15, 5))
        entry = tk.Entry(dialog, width=30, font=("Microsoft YaHei", 10))
        entry.pack(pady=(0, 10))

        def do_remove():
            title = entry.get().strip()
            if not title:
                return
            output = run_cmd("--remove-jd", title)
            self.log(output)
            dialog.destroy()

        tk.Button(dialog, text="确认删除", command=do_remove, width=12,
                  bg="#D9534F", fg="white", font=("Microsoft YaHei", 10)).pack()

    def open_reports(self):
        os.startfile(REPORTS_DIR)
        self.log("已打开评分报告文件夹")


if __name__ == "__main__":
    root = tk.Tk()
    app = App(root)
    root.mainloop()
