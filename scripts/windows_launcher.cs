using System;
using System.Diagnostics;
using System.IO;

internal static class Program
{
    private static int Main()
    {
        string executableDir = AppDomain.CurrentDomain.BaseDirectory;
        string projectRoot = Path.GetFullPath(Path.Combine(executableDir, ".."));
        string indexFile = Path.Combine(projectRoot, "index.html");

        if (!File.Exists(indexFile))
        {
            ShowError(
                "Nao encontrei os arquivos do sistema.",
                "Mantenha este executavel dentro da pasta Executavel do projeto TRANSLOG."
            );
            return 1;
        }

        OpenAppWindow(new Uri(indexFile).AbsoluteUri);
        return 0;
    }

    private static void OpenAppWindow(string url)
    {
        string browser = FindChromiumBrowser();
        if (!string.IsNullOrEmpty(browser))
        {
            try
            {
                ProcessStartInfo appInfo = new ProcessStartInfo
                {
                    FileName = browser,
                    Arguments = "--app=\"" + url + "\" --window-size=1440,920 --disable-features=Translate",
                    UseShellExecute = false,
                    WorkingDirectory = AppDomain.CurrentDomain.BaseDirectory
                };
                Process.Start(appInfo);
                return;
            }
            catch
            {
                // Fallback below opens the URL with the Windows default handler.
            }
        }

        try
        {
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            };
            Process.Start(info);
        }
        catch
        {
            Console.WriteLine("Abra manualmente: " + url);
        }
    }

    private static string FindChromiumBrowser()
    {
        string[] candidates =
        {
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Microsoft", "Edge", "Application", "msedge.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Google", "Chrome", "Application", "chrome.exe"),
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Google", "Chrome", "Application", "chrome.exe")
        };

        foreach (string candidate in candidates)
        {
            if (File.Exists(candidate)) return candidate;
        }

        return "";
    }

    private static void ShowError(string title, string detail)
    {
        Console.Error.WriteLine(title);
        Console.Error.WriteLine(detail);
        try
        {
            ProcessStartInfo info = new ProcessStartInfo
            {
                FileName = "cmd",
                Arguments = "/c echo " + title + " & echo " + detail + " & pause",
                UseShellExecute = true
            };
            Process.Start(info);
        }
        catch
        {
            // Console output above is enough when a message window cannot be opened.
        }
    }
}
