using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;

[assembly: AssemblyTitle("CPL TRANSLOG HTML")]
[assembly: AssemblyDescription("Sistema local de contratos, lancamentos e CRUD operacional")]
[assembly: AssemblyCompany("CPL TRANSLOG")]
[assembly: AssemblyProduct("CPL TRANSLOG HTML")]
[assembly: AssemblyVersion("1.0.0.0")]
[assembly: AssemblyFileVersion("1.0.0.0")]

internal static class Program
{
    private const string ResourceName = "TranslogAppPackage";

    private static int Main()
    {
        try
        {
            EnsureOperationalFolders();
            string appDir = ExtractAppPackage();
            WriteLog("App package extracted to " + appDir);
            string indexFile = Path.Combine(appDir, "index.html");
            if (!File.Exists(indexFile))
            {
                ShowError("Arquivo principal nao encontrado no pacote.", indexFile);
                return 1;
            }

            OpenAppWindow(new Uri(indexFile).AbsoluteUri, appDir);
            WriteLog("App window requested.");
            return 0;
        }
        catch (Exception ex)
        {
            WriteLog("ERROR: " + ex);
            ShowError("Nao foi possivel abrir o CPL TRANSLOG HTML.", ex.Message);
            return 2;
        }
    }

    private static string ProductRoot()
    {
        return Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "CPL TRANSLOG HTML"
        );
    }

    private static void EnsureOperationalFolders()
    {
        string root = ProductRoot();
        Directory.CreateDirectory(root);
        Directory.CreateDirectory(Path.Combine(root, "App"));
        Directory.CreateDirectory(Path.Combine(root, "Dados"));
        Directory.CreateDirectory(Path.Combine(root, "Backups"));
        Directory.CreateDirectory(Path.Combine(root, "Exportacoes"));
        Directory.CreateDirectory(Path.Combine(root, "Logs"));
    }

    private static void WriteLog(string message)
    {
        try
        {
            string logPath = Path.Combine(ProductRoot(), "Logs", "startup.log");
            File.AppendAllText(logPath, DateTime.Now.ToString("s") + " " + message + Environment.NewLine);
        }
        catch
        {
            // Logging must never block the app.
        }
    }

    private static string ExtractAppPackage()
    {
        string baseDir = Path.Combine(ProductRoot(), "App");

        if (Directory.Exists(baseDir))
        {
            Directory.Delete(baseDir, true);
        }
        Directory.CreateDirectory(baseDir);

        Assembly assembly = Assembly.GetExecutingAssembly();
        using (Stream stream = assembly.GetManifestResourceStream(ResourceName))
        {
            if (stream == null)
            {
                throw new InvalidOperationException("Recurso embutido do app nao encontrado.");
            }

            using (ZipArchive archive = new ZipArchive(stream, ZipArchiveMode.Read))
            {
                foreach (ZipArchiveEntry entry in archive.Entries)
                {
                    string destination = Path.GetFullPath(Path.Combine(baseDir, entry.FullName));
                    if (!destination.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase))
                    {
                        continue;
                    }

                    if (String.IsNullOrEmpty(entry.Name))
                    {
                        Directory.CreateDirectory(destination);
                        continue;
                    }

                    Directory.CreateDirectory(Path.GetDirectoryName(destination));
                    entry.ExtractToFile(destination, true);
                }
            }
        }

        return baseDir;
    }

    private static void OpenAppWindow(string url, string workingDirectory)
    {
        string browser = FindChromiumBrowser();
        if (!String.IsNullOrEmpty(browser))
        {
            ProcessStartInfo appInfo = new ProcessStartInfo
            {
                FileName = browser,
                Arguments = "--app=\"" + url + "\" --window-size=1440,920 --disable-features=Translate",
                UseShellExecute = false,
                WorkingDirectory = workingDirectory
            };
            Process.Start(appInfo);
            return;
        }

        ProcessStartInfo fallback = new ProcessStartInfo
        {
            FileName = url,
            UseShellExecute = true
        };
        Process.Start(fallback);
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
