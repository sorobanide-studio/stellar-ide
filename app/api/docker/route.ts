import { NextResponse } from 'next/server';
import {
createAndInitializeContainer,
deleteContainer,
getContainerFiles,
getFileContent,
saveFileContent,
createFile,
createFolder,
deleteFile,
deleteFolder,
createAccount,
deployContract,
buildContract,
checkContainerHealth,
isValidStellarAddress
getToolchainVersions
} from '@/lib/docker';
import {
getAllProjects,
createProject,
deleteProject,
getProject,
renameProject
} from '@/lib/projects';

export async function POST(request: Request) {
try {
const { action, walletAddress, filePath, content, publicKey, projectName, description, oldName, newName, removeVolume } = await request.json();

// Validate wallet address is provided
// A wallet address is required for every action, including checkHealth:
// getContainerName validates it and would otherwise throw inside the handler
// and be turned into a 500 (with `details`) instead of a 400.
if (!walletAddress) {
  return NextResponse.json(
    { error: 'Wallet address is required' },
    { status: 400 }
  );
}

// Reject anything that is not a well-formed Stellar public key before it is
// used to build a container name or any docker command.
if (!isValidStellarAddress(walletAddress)) {
  return NextResponse.json(
    { error: 'Invalid wallet address' },
    { status: 400 }
  );
}

switch (action) {
  case 'create':
    const createResult = await createAndInitializeContainer(walletAddress);
    return NextResponse.json(createResult);

  case 'delete':
    // The workspace volume is retained unless the caller explicitly opts in
    // with `removeVolume: true`.
    const deleteResult = await deleteContainer(walletAddress, { removeVolume });
    return NextResponse.json(deleteResult);

  case 'getFiles':
    const filesResult = await getContainerFiles(walletAddress, projectName);
    return NextResponse.json(filesResult);

  case 'getFileContent':
    const fileContentResult = await getFileContent(walletAddress, filePath, projectName);
    return NextResponse.json(fileContentResult);

  case 'saveFileContent':
    const saveResult = await saveFileContent(walletAddress, filePath, content, projectName);
    return NextResponse.json(saveResult);

  case 'createFile':
    const createFileResult = await createFile(walletAddress, filePath, content ?? '', projectName);
    return NextResponse.json(createFileResult);

  case 'createFolder':
    const createFolderResult = await createFolder(walletAddress, filePath, projectName);
    return NextResponse.json(createFolderResult);

  case 'deleteFile':
    const deleteFileResult = await deleteFile(walletAddress, filePath, projectName);
    return NextResponse.json(deleteFileResult);

  case 'deleteFolder':
    const deleteFolderResult = await deleteFolder(walletAddress, filePath, projectName);
    return NextResponse.json(deleteFolderResult);
  
  case 'createAccount':
    const createAccountResult = await createAccount(walletAddress);
    return NextResponse.json(createAccountResult);

  case 'deployContract':
    const deployContractResult = await deployContract(walletAddress, publicKey, projectName);
    return NextResponse.json(deployContractResult);

  case 'buildContract':
    const buildContractResult = await buildContract(walletAddress, projectName);
    return NextResponse.json(buildContractResult);

  // Project management endpoints
  case 'getAllProjects':
    const allProjects = await getAllProjects(walletAddress);
    return NextResponse.json({ success: true, projects: allProjects });

  case 'createProject':
    const createProjectResult = await createProject(walletAddress, projectName, description);
    return NextResponse.json(createProjectResult);

  case 'deleteProject':
    const deleteProjectResult = await deleteProject(walletAddress, projectName);
    return NextResponse.json(deleteProjectResult);

  case 'getProject':
    const getProjectResult = await getProject(walletAddress, projectName);
    return NextResponse.json(getProjectResult);

  case 'renameProject':
    const renameProjectResult = await renameProject(walletAddress, oldName, newName);
    return NextResponse.json(renameProjectResult);

  case 'checkHealth':
    const isHealthy = await checkContainerHealth(walletAddress);
    const toolchainVersions = isHealthy
      ? await getToolchainVersions(walletAddress)
      : null;
    return NextResponse.json({ isHealthy, walletAddress, toolchainVersions });

  default:
    return NextResponse.json(
      { error: 'Unknown action' },
      { status: 400 }
    );
}
} catch (error) {
console.error('API error:', error);
return NextResponse.json(
{ error: 'Internal server error', details: String(error) },
{ status: 500 }
);
}
}