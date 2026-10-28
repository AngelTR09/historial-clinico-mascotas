import { signOwnerToken, signVetPetAccessToken, signVetToken, verifyOwnerToken, verifyVetPetAccessToken, verifyVetToken, } from "../../auth/jwt.js";
export class AdaptadorAutenticacionJwtLocal {
    async issueOwnerToken(idDueno) {
        return signOwnerToken(idDueno);
    }
    async verifyOwnerToken(token) {
        return verifyOwnerToken(token);
    }
    async issueVetToken(idVeterinario) {
        return signVetToken(idVeterinario);
    }
    async verifyVetToken(token) {
        return verifyVetToken(token);
    }
    async issueVetPetAccessToken(idVeterinario, idMascota) {
        return signVetPetAccessToken(idVeterinario, idMascota);
    }
    async verifyVetPetAccessToken(token) {
        return verifyVetPetAccessToken(token);
    }
}
